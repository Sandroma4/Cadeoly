require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { PrismaClient } = require("@wishi/prisma-client");
const {
  readMyReservations,
  hashShareToken,
} = require("../src/lib/wishlist-service.ts");
const { readMyContributions } = require("../src/lib/contribution-service.ts");
const { readReminders } = require("../src/lib/reminders.ts");
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "cadeoly-audit-reminders-"),
);
const file = path.join(directory, "test.db");
const sql = new DatabaseSync(file);
for (const migration of fs
  .readdirSync(path.join(__dirname, "../prisma/migrations"))
  .filter((v) => /^\d/.test(v))
  .sort()) {
  sql.exec(
    fs.readFileSync(
      path.join(__dirname, "../prisma/migrations", migration, "migration.sql"),
      "utf8",
    ),
  );
}
sql.close();
const db = new PrismaClient({
  datasources: { db: { url: "file:" + file.replaceAll("\\", "/") } },
});
after(async () => {
  await db.$disconnect();
  if (
    path.dirname(directory) === os.tmpdir() &&
    path.basename(directory).startsWith("cadeoly-audit-reminders-")
  )
    fs.rmSync(directory, { recursive: true, force: true });
});
const now = new Date("2026-10-09T10:00:00Z");
async function fixture() {
  const owner = await db.user.create({ data: { name: "Parent" } });
  const viewer = await db.user.create({ data: { name: "Guest" } });
  const family = await db.family.create({
    data: {
      name: "Family",
      ownerId: owner.id,
      members: { create: [{ userId: owner.id }, { userId: viewer.id }] },
    },
  });
  const recipient = await db.recipient.create({
    data: { name: "Child", ownerId: owner.id },
  });
  const list = await db.wishlist.create({
    data: {
      name: "Child wishes",
      ownerId: owner.id,
      recipientId: recipient.id,
      neededBy: "2026-10-12",
      visibility: "FAMILY",
    },
  });
  return { owner, viewer, family, list };
}
async function gift(list, viewer, data = {}, kind = "reservation") {
  const item = await db.wishlistItem.create({
    data: {
      title: "Gift",
      wishlistId: list.id,
      isGroupGift: kind === "contribution",
      priceCents: 10000,
      ...data,
    },
  });
  await db[kind].create({
    data: {
      itemId: item.id,
      userId: viewer.id,
      ...(kind === "contribution" ? { amountCents: 1000 } : {}),
      ...(list.visibility === "LINK"
        ? { accessTokenHash: hashShareToken(list.shareToken) }
        : {}),
    },
  });
  return item;
}
function countedDb() {
  let checks = 0;
  return {
    db: new Proxy(db, {
      get(target, key) {
        if (key === "family")
          return new Proxy(target.family, {
            get(model, operation) {
              if (operation === "findFirst" || operation === "findMany")
                return async (...args) => {
                  checks++;
                  return model[operation](...args);
                };
              return model[operation];
            },
          });
        return target[key];
      },
    }),
    count: () => checks,
  };
}
test("reservations use actual recipient with owner fallback", async () => {
  const { viewer, list } = await fixture();
  await gift(list, viewer);
  assert.equal(
    (await readMyReservations(db, viewer.id))[0].gift.recipient,
    "Child",
  );
  await db.wishlist.update({
    where: { id: list.id },
    data: { recipientId: null },
  });
  assert.equal(
    (await readMyReservations(db, viewer.id))[0].gift.recipient,
    "Parent",
  );
});
test("each read shares family access checks across 25 reservations and contributions and refreshes after membership removal", async () => {
  const { viewer, list, family } = await fixture();
  for (let i = 0; i < 25; i++) {
    await gift(list, viewer, { title: `Reserved ${i}` });
    await gift(list, viewer, { title: `Collective ${i}` }, "contribution");
  }
  for (const read of [readMyReservations, readMyContributions, readReminders]) {
    const counted = countedDb();
    const result = await read(counted.db, viewer.id, now);
    assert.equal(counted.count(), 1, `${read.name}: one family access query`);
    if (read === readMyReservations) assert.ok(result.every((row) => row.gift));
    if (read === readMyContributions)
      assert.ok(result.every((row) => row.title));
    if (read === readReminders) assert.equal(result.gifts.length, 12);
  }
  await db.familyMember.deleteMany({
    where: { familyId: family.id, userId: viewer.id },
  });
  assert.ok(
    (await readMyReservations(db, viewer.id)).every((row) => row.gift === null),
  );
  assert.ok(
    (await readMyContributions(db, viewer.id)).every(
      (row) => row.title === null && row.href === null,
    ),
  );
  assert.equal((await readReminders(db, viewer.id, now)).gifts.length, 0);
});
test("reservation access for many distinct family owners uses one membership query", async () => {
  const { viewer, family } = await fixture();
  for (let i = 0; i < 6; i++) {
    const owner = await db.user.create({ data: { name: `Owner ${i}` } });
    await db.familyMember.create({
      data: { familyId: family.id, userId: owner.id },
    });
    const list = await db.wishlist.create({
      data: { name: "Wishes", ownerId: owner.id, visibility: "FAMILY" },
    });
    await gift(list, viewer);
  }
  const counted = countedDb();
  const rows = await readMyReservations(counted.db, viewer.id);
  assert.equal(rows.length, 6);
  assert.ok(rows.every((row) => row.gift));
  assert.equal(counted.count(), 1);
});

test("shared membership decisions preserve each list's visibility, lifecycle and owner", async () => {
  const { viewer, owner, list } = await fixture();
  const active = await gift(list, viewer);
  const otherOwner = await db.user.create({ data: { name: "Unrelated" } });
  const second = await db.wishlist.create({
    data: {
      ownerId: owner.id,
      name: "Second",
      visibility: "FAMILY",
      neededBy: "2026-10-11",
    },
  });
  const secondGift = await gift(second, viewer, {}, "contribution");
  const hiddenIds = [];
  for (const data of [
    { archivedAt: now },
    { deletedAt: now },
    { visibility: "PRIVATE" },
    { ownerId: otherOwner.id },
  ]) {
    const hidden = await db.wishlist.create({
      data: {
        ownerId: owner.id,
        name: "Hidden",
        visibility: "FAMILY",
        neededBy: "2026-10-11",
        ...data,
      },
    });
    const item = await gift(hidden, viewer, {}, "contribution");
    await db.reservation.create({
      data: { itemId: item.id, userId: viewer.id },
    });
    hiddenIds.push(item.id);
  }
  const reservations = await readMyReservations(db, viewer.id);
  assert.ok(reservations.find((row) => row.itemId === active.id).gift);
  assert.ok(
    reservations
      .filter((row) => hiddenIds.includes(row.itemId))
      .every((row) => row.gift === null),
  );
  const contributions = await readMyContributions(db, viewer.id);
  assert.ok(contributions.find((row) => row.itemId === secondGift.id).title);
  assert.ok(
    contributions
      .filter((row) => hiddenIds.includes(row.itemId))
      .every((row) => row.title === null),
  );
  assert.deepEqual(
    (await readReminders(db, viewer.id, now)).gifts.map((row) => row.id),
    [secondGift.id, active.id],
  );
  await db.wishlist.update({
    where: { id: list.id },
    data: { visibility: "PRIVATE" },
  });
  assert.equal(
    (await readMyReservations(db, viewer.id)).find(
      (row) => row.itemId === active.id,
    ).gift,
    null,
  );
});
test("collective reminders sort with reservations, deduplicate and exclude inaccessible, own, deleted and out-of-range gifts", async () => {
  const { viewer, owner, list } = await fixture();
  const reserved = await gift(list, viewer, { title: "Reserved" });
  const early = await db.wishlist.create({
    data: {
      ownerId: owner.id,
      name: "Early",
      visibility: "FAMILY",
      neededBy: "2026-10-10",
    },
  });
  const collective = await gift(
    early,
    viewer,
    { title: "Collective" },
    "contribution",
  );
  await db.reservation.create({
    data: { itemId: collective.id, userId: viewer.id },
  });
  await gift(
    list,
    viewer,
    { title: "Deleted", deletedAt: now },
    "contribution",
  );
  for (const [name, data] of Object.entries({
    Private: { visibility: "PRIVATE" },
    Archived: { archivedAt: now },
    Removed: { deletedAt: now },
    Late: { neededBy: "2026-11-15" },
    Own: { ownerId: viewer.id },
  })) {
    const hidden = await db.wishlist.create({
      data: {
        ownerId: owner.id,
        name,
        visibility: "FAMILY",
        neededBy: "2026-10-11",
        ...data,
      },
    });
    await gift(hidden, viewer, { title: name }, "contribution");
  }
  const rows = (await readReminders(db, viewer.id, now)).gifts;
  assert.deepEqual(
    rows.map((row) => row.id),
    [collective.id, reserved.id],
  );
  assert.equal(rows[0].kind, "contribution");
  assert.equal(rows[1].kind, "reservation");
  assert.equal(rows[0].recipient, "Parent");
  for (const locale of ["fr", "en"])
    assert.match(
      require(`../messages/${locale}.json`).improvements.contributedGift,
      /\{name\}/,
    );
});
test("link rotation and mixed per-row grants are respected on every read", async () => {
  const { owner, viewer } = await fixture();
  const list = await db.wishlist.create({
    data: {
      ownerId: owner.id,
      name: "Link",
      visibility: "LINK",
      shareToken: "audit-original",
      neededBy: "2026-10-11",
    },
  });
  const valid = await gift(list, viewer, {}, "contribution");
  const invalid = await gift(list, viewer, {});
  await db.reservation.update({
    where: { itemId: invalid.id },
    data: { accessTokenHash: "revoked" },
  });
  assert.equal((await readMyReservations(db, viewer.id))[0].gift, null);
  assert.equal((await readMyContributions(db, viewer.id))[0].title, "Gift");
  assert.deepEqual(
    (await readReminders(db, viewer.id, now)).gifts.map((row) => row.id),
    [valid.id],
  );
  await db.wishlist.update({
    where: { id: list.id },
    data: { shareToken: "audit-rotated" },
  });
  assert.equal((await readMyContributions(db, viewer.id))[0].title, null);
  assert.equal((await readReminders(db, viewer.id, now)).gifts.length, 0);
});
