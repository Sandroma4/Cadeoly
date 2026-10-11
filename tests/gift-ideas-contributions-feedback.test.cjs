require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test, before, after } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { DatabaseSync } = require("node:sqlite"),
  { PrismaClient } = require("@wishi/prisma-client");
const { canonicalGiftUrl } = require("../src/lib/duplicate-gifts.ts");
const {
  contributeGift,
  cancelContribution,
  readMyContributions,
} = require("../src/lib/contribution-service.ts");
const { readWishlist, reserveGift } = require("../src/lib/wishlist-service.ts");
const { submitFeedback } = require("../src/lib/feedback-service.ts");
const { wishlistSchema } = require("../src/lib/validation.ts");
const { readGiftIdeas } = require("../src/lib/gift-ideas.ts");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wishi-new-features-")),
  file = path.join(directory, "test.db");
const sql = new DatabaseSync(file);
for (const migration of fs
  .readdirSync(path.join(__dirname, "../prisma/migrations"))
  .filter((v) => /^\d/.test(v))
  .sort())
  sql.exec(
    fs.readFileSync(
      path.join(__dirname, "../prisma/migrations", migration, "migration.sql"),
      "utf8",
    ),
  );
sql.close();
const db = new PrismaClient({
  datasources: { db: { url: "file:" + file.replaceAll("\\", "/") } },
});
let owner, a, b, list, gift;
before(async () => {
  [owner, a, b] = await Promise.all(
    ["owner", "a", "b"].map((name) =>
      db.user.create({ data: { name, email: name + "@example.test" } }),
    ),
  );
  list = await db.wishlist.create({
    data: {
      name: "Group",
      ownerId: owner.id,
      visibility: "LINK",
      shareToken: "current-token",
      occasion: "Birthday",
      neededBy: "2026-12-25",
      preferences: "Blue",
    },
  });
  gift = await db.wishlistItem.create({
    data: {
      title: "Group gift",
      wishlistId: list.id,
      isGroupGift: true,
      priceCents: 10000,
    },
  });
});
after(async () => {
  await db.$disconnect();
  if (
    path.dirname(directory) === os.tmpdir() &&
    path.basename(directory).startsWith("wishi-new-features-")
  )
    fs.rmSync(directory, { recursive: true, force: true });
});

test("gift ideas exclude own, private, linked, reserved, deleted and funded gifts", async () => {
  const [owner, a, b] = await Promise.all(["ideas-owner", "ideas-a", "ideas-b"].map(name => db.user.create({ data: { name, email: `${name}@example.test` } })));
  const family = await db.family.create({ data: { name: "Ideas family", owner: { connect: { id: owner.id } }, members: { create: [{ userId: owner.id, role: "OWNER" }, { userId: a.id, role: "MEMBER" }] } } });
  assert.ok(family.id);
  const create = async (name, data = {}, item = {}) => {
    const list = await db.wishlist.create({ data: { name, ownerId: owner.id, visibility: "FAMILY", ...data } });
    return db.wishlistItem.create({ data: { title: name, wishlistId: list.id, priceCents: 1000, ...item } });
  };
  const available = await create("Available");
  await create("Private", { visibility: "PRIVATE" });
  await create("Link", { visibility: "LINK" });
  await create("Archived", { archivedAt: new Date() });
  await create("Deleted list", { deletedAt: new Date() });
  await create("Deleted gift", {}, { deletedAt: new Date() });
  await create("Own", { ownerId: a.id });
  await create("Foreign family", { ownerId: b.id, visibility: "PUBLIC" });
  const reserved = await create("Reserved");
  await db.reservation.create({ data: { itemId: reserved.id, userId: a.id } });
  const funded = await create("Funded", {}, { isGroupGift: true });
  await db.contribution.create({ data: { itemId: funded.id, userId: a.id, amountCents: 1000 } });
  const ideas = await readGiftIdeas(db, a.id);
  assert.deepEqual(ideas.map(i => i.id), [available.id]);
  assert.equal("contributions" in ideas[0], false);
  assert.deepEqual(await readGiftIdeas(db, b.id), []);
});
test("duplicate detection drops trackers but preserves product variants", () => {
  assert.equal(
    canonicalGiftUrl("https://www.shop.test/p?id=1&utm_source=x#details"),
    canonicalGiftUrl("http://shop.test/p/?id=1"),
  );
  assert.notEqual(
    canonicalGiftUrl("https://shop.test/p?size=M"),
    canonicalGiftUrl("https://shop.test/p?size=L"),
  );
  assert.equal(canonicalGiftUrl("javascript:alert(1)"), null);
});
test("personalized list validation bounds content and validates dates", () => {
  assert.equal(
    wishlistSchema.safeParse({
      name: "List",
      visibility: "PRIVATE",
      occasion: "Birthday",
      neededBy: "2026-02-30",
    }).success,
    false,
  );
  assert.equal(
    wishlistSchema.safeParse({
      name: "List",
      visibility: "PRIVATE",
      preferences: "x".repeat(2001),
    }).success,
    false,
  );
});
test("group pledges require access, never reveal owner totals and do not allow overfunding", async () => {
  assert.equal(
    (await contributeGift(db, gift.id, owner.id, 1000, "current-token")).error,
    "forbidden",
  );
  assert.equal(
    (await contributeGift(db, gift.id, a.id, 1000, "wrong-token")).error,
    "forbidden",
  );
  assert.equal(
    (await reserveGift(db, gift.id, a.id, "current-token")).error,
    "forbidden",
  );
  assert.equal(
    (await contributeGift(db, gift.id, a.id, 6000, "current-token")).success,
    true,
  );
  assert.equal(
    (await contributeGift(db, gift.id, b.id, 5000, "current-token")).error,
    "groupBudgetExceeded",
  );
  assert.equal(
    (await contributeGift(db, gift.id, b.id, 4000, "current-token")).success,
    true,
  );
  const ownerView = await readWishlist(db, list.id, owner.id);
  assert.equal(ownerView.items[0].contributedCents, 0);
  assert.equal(ownerView.items[0].myContributionCents, 0);
  assert.equal(ownerView.items[0].isReserved, false);
  assert.equal("contributions" in ownerView.items[0], false);
  const giverView = await readWishlist(db, list.id, a.id, "current-token");
  assert.equal(giverView.items[0].contributedCents, 10000);
  assert.equal(giverView.items[0].myContributionCents, 6000);
  assert.equal(giverView.items[0].isReserved, true);
  assert.equal("contributions" in giverView.items[0], false);
  assert.equal(
    (await contributeGift(db, gift.id, a.id, 5000, "current-token")).success,
    true,
  );
  await db.wishlist.update({
    where: { id: list.id },
    data: { shareToken: "new-token" },
  });
  assert.equal(await readWishlist(db, list.id, b.id, "current-token"), null);
  assert.equal(
    (await readWishlist(db, list.id, b.id, "new-token")).items[0]
      .contributedCents,
    0,
  );
  assert.equal((await readMyContributions(db, a.id))[0].title, null);
  await cancelContribution(db, gift.id, a.id);
  assert.equal(await db.contribution.count({ where: { userId: b.id } }), 1);
  assert.equal(await db.contribution.count({ where: { userId: a.id } }), 0);
});
test("simultaneous group pledges cannot exceed the target", async () => {
  const item = await db.wishlistItem.create({
    data: {
      title: "Concurrent",
      wishlistId: list.id,
      isGroupGift: true,
      priceCents: 1000,
    },
  });
  await Promise.all([
    contributeGift(db, item.id, a.id, 700, "new-token"),
    contributeGift(db, item.id, b.id, 700, "new-token"),
  ]);
  assert.ok(
    (
      await db.contribution.aggregate({
        where: { itemId: item.id },
        _sum: { amountCents: true },
      })
    )._sum.amountCents <= 1000,
  );
});
test("feedback is bounded, rate limited and associated only with its author", async () => {
  assert.equal(
    (await submitFeedback(db, a.id, "BUG", "short", "secret")).error,
    "invalidFields",
  );
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await submitFeedback(
          db,
          a.id,
          "BUG",
          "A sufficiently detailed report",
          "secret",
        )
      ).success,
      true,
    );
  assert.equal(
    (
      await submitFeedback(
        db,
        a.id,
        "BUG",
        "A sufficiently detailed report",
        "secret",
      )
    ).error,
    "rateLimited",
  );
  assert.equal(await db.feedback.count({ where: { userId: a.id } }), 5);
  assert.equal(await db.feedback.count({ where: { userId: b.id } }), 0);
});
test("hosted migrations verify an old-schema backup before upgrading", () => {
  const { createHash, randomUUID } = require("node:crypto");
  const { spawnSync } = require("node:child_process");
  const oldFile = path.join(directory, "before-migration.db");
  const photos = path.join(directory, "migration-photos");
  fs.mkdirSync(photos);
  const old = new DatabaseSync(oldFile);
  old.exec(
    "CREATE TABLE _prisma_migrations (id TEXT PRIMARY KEY, checksum TEXT NOT NULL, migration_name TEXT NOT NULL, logs TEXT, rolled_back_at DATETIME, started_at DATETIME DEFAULT CURRENT_TIMESTAMP, finished_at DATETIME, applied_steps_count INTEGER DEFAULT 0)",
  );
  const migrations = path.join(__dirname, "../prisma/migrations");
  for (const name of fs
    .readdirSync(migrations)
    .filter((name) => /^20261003/.test(name))
    .sort()) {
    const text = fs.readFileSync(
      path.join(migrations, name, "migration.sql"),
      "utf8",
    );
    old.exec(text);
    old
      .prepare(
        "INSERT INTO _prisma_migrations (id,checksum,migration_name,finished_at,applied_steps_count) VALUES (?,?,?,CURRENT_TIMESTAMP,1)",
      )
      .run(randomUUID(), createHash("sha256").update(text).digest("hex"), name);
  }
  old.close();
  const mount = path.join(directory, "hosted-volume");
  fs.mkdirSync(mount);
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "../scripts/migrate.cjs")],
    {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8",
      timeout: 30000,
      env: {
        ...process.env,
        DATABASE_URL: "file:" + oldFile.replaceAll("\\", "/"),
        UPLOAD_DIR: photos,
        RAILWAY_VOLUME_MOUNT_PATH: mount,
        BACKUP_ROOT: path.join(mount, "backups"),
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /Wishi pre-migration backup and restoration verified/,
  );
  const status = JSON.parse(
    fs.readFileSync(
      path.join(mount, "pre-migration-backup-status.json"),
      "utf8",
    ),
  );
  assert.equal(status.success, true);
  assert.equal(status.restorationVerified, true);
  const snapshot = new DatabaseSync(path.join(status.backup, "database.db"), {
    readOnly: true,
  });
  assert.equal(
    snapshot
      .prepare('PRAGMA table_info("Wishlist")')
      .all()
      .some((column) => column.name === "occasion"),
    false,
  );
  snapshot.close();
  const upgraded = new DatabaseSync(oldFile, { readOnly: true });
  assert.equal(
    upgraded
      .prepare('PRAGMA table_info("Wishlist")')
      .all()
      .some((column) => column.name === "occasion"),
    true,
  );
  upgraded.close();
});
