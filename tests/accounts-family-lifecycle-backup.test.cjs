require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { PrismaClient } = require("@wishi/prisma-client");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("node:crypto");
const {
  allowAccountAttempt,
  authenticateAccount,
  changeAccountPassword,
} = require("../src/lib/account-service.ts");
const { manageFamily } = require("../src/lib/family-service.ts");
const {
  changeGiftState,
  readTrashedGifts,
} = require("../src/lib/gift-lifecycle-service.ts");
const { dailyBackup } = require("../scripts/daily-backup.cjs");
const { copyExternalBackup } = require("../scripts/external-backup.cjs");
const {
  changeListState,
  duplicateList,
} = require("../src/lib/list-lifecycle-service.ts");
const {
  readWishlist,
  readMyReservations,
  reserveGift,
} = require("../src/lib/wishlist-service.ts");
const { sessionIsCurrent } = require("../src/lib/password-reset-service.ts");
const {
  makeBackup,
  verifyBackup,
  restoreBackup,
} = require("../scripts/backup.cjs");
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "wishi-next-priorities-"),
);
const database = path.join(directory, "test.db"),
  photos = path.join(directory, "photos");
fs.mkdirSync(photos);
process.env.UPLOAD_DIR = photos;
const sql = new DatabaseSync(database);
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
  datasources: { db: { url: "file:" + database.replaceAll("\\", "/") } },
});
let owner, member, stranger;
before(async () => {
  [owner, member, stranger] = await Promise.all(
    ["owner", "member", "stranger"].map((name) =>
      db.user.create({
        data: { name, email: `${name}@example.test`, password: "placeholder" },
      }),
    ),
  );
});
after(async () => {
  await db.$disconnect();
  if (
    path.dirname(directory) === os.tmpdir() &&
    path.basename(directory).startsWith("wishi-next-priorities-")
  )
    fs.rmSync(directory, { recursive: true, force: true });
});
test("login limits remain atomic and never store clear email identities", async () => {
  const results = await Promise.all(
    Array.from({ length: 15 }, () =>
      allowAccountAttempt(db, "atomic", "private@example.test", "secret", 10),
    ),
  );
  assert.equal(results.filter(Boolean).length, 10);
  assert.equal(
    (await db.authRequestThrottle.findMany()).some((row) =>
      row.key.includes("private@example.test"),
    ),
    false,
  );
  for (let i = 0; i < 10; i++)
    assert.equal(
      (await authenticateAccount(db, "absent@example.test", "wrong", "secret"))
        .limited,
      false,
    );
  assert.equal(
    (await authenticateAccount(db, "absent@example.test", "wrong", "secret"))
      .limited,
    true,
  );
});
test("changing password requires current password and revokes sessions and reset links", async () => {
  await db.user.update({
    where: { id: owner.id },
    data: { password: await bcrypt.hash("Old-password-2026!", 4) },
  });
  await db.passwordResetToken.create({
    data: {
      userId: owner.id,
      tokenHash: "a".repeat(64),
      expires: new Date(Date.now() + 60_000),
    },
  });
  assert.equal(
    (
      await changeAccountPassword(
        db,
        owner.id,
        "wrong",
        "New-password-2026!",
        "secret",
      )
    ).error,
    "wrongPassword",
  );
  assert.equal(await sessionIsCurrent(db, owner.id, 0), true);
  assert.equal(
    (
      await changeAccountPassword(
        db,
        owner.id,
        "Old-password-2026!",
        "New-password-2026!",
        "secret",
      )
    ).success,
    true,
  );
  const updated = await db.user.findUnique({ where: { id: owner.id } });
  assert.equal(
    await bcrypt.compare("New-password-2026!", updated.password),
    true,
  );
  assert.equal(await sessionIsCurrent(db, owner.id, 0), false);
  assert.equal(
    await db.passwordResetToken.count({ where: { userId: owner.id } }),
    0,
  );
});
test("family owner protection, transfer, departure, and removal preserve lists", async () => {
  const family = await db.family.create({
    data: {
      name: "Family",
      ownerId: owner.id,
      members: {
        create: [
          { userId: owner.id, role: "ADMIN" },
          { userId: member.id, role: "MEMBER" },
        ],
      },
    },
  });
  const event = await db.event.create({
    data: { name: "Birthday", date: new Date(), familyId: family.id },
  });
  const list = await db.wishlist.create({
    data: {
      name: "Keep",
      ownerId: owner.id,
      eventId: event.id,
      visibility: "FAMILY",
    },
  });
  assert.equal(
    (await manageFamily(db, family.id, stranger.id, "promote", member.id))
      .error,
    "forbidden",
  );
  assert.equal(
    (await manageFamily(db, family.id, owner.id, "leave")).error,
    "transferFirst",
  );
  assert.equal(
    (await manageFamily(db, family.id, owner.id, "transfer", member.id))
      .success,
    true,
  );
  assert.equal(
    (await manageFamily(db, family.id, member.id, "remove", member.id)).error,
    "transferFirst",
  );
  assert.equal(
    (await manageFamily(db, family.id, owner.id, "leave")).success,
    true,
  );
  assert.equal(
    (await db.wishlist.findUnique({ where: { id: list.id } })).eventId,
    null,
  );
  assert.equal(await readWishlist(db, list.id, member.id), null);
  assert.equal(
    (
      await db.familyMember.findUnique({
        where: { userId_familyId: { userId: member.id, familyId: family.id } },
      })
    ).role,
    "ADMIN",
  );
});
test("last administrator guard also protects existing inconsistent legacy ownership", async () => {
  const family = await db.family.create({
    data: {
      name: "Legacy",
      ownerId: owner.id,
      members: {
        create: [
          { userId: owner.id, role: "MEMBER" },
          { userId: member.id, role: "ADMIN" },
        ],
      },
    },
  });
  assert.equal(
    (await manageFamily(db, family.id, member.id, "leave")).error,
    "lastAdmin",
  );
});
test("member removal revokes invitations and preserves their gifts", async () => {
  const family = await db.family.create({
    data: {
      name: "Removal",
      ownerId: owner.id,
      members: {
        create: [
          { userId: owner.id, role: "ADMIN" },
          { userId: member.id, role: "MEMBER" },
        ],
      },
    },
  });
  const invitation = await db.invitation.create({
    data: {
      familyId: family.id,
      email: member.email,
      token: "removal-token",
      expires: new Date(Date.now() + 60_000),
    },
  });
  const list = await db.wishlist.create({
    data: {
      name: "Preserved",
      ownerId: member.id,
      items: { create: { title: "Preserved gift" } },
    },
  });
  assert.equal(
    (await manageFamily(db, family.id, owner.id, "remove", member.id)).success,
    true,
  );
  assert.equal(
    await db.invitation.findUnique({ where: { id: invitation.id } }),
    null,
  );
  assert.equal(
    await db.wishlistItem.count({ where: { wishlistId: list.id } }),
    1,
  );
  assert.equal(
    await db.familyMember.count({
      where: { familyId: family.id, userId: member.id },
    }),
    0,
  );
});
test("concurrent administrator departures cannot remove the final administrator", async () => {
  const family = await db.family.create({
    data: {
      name: "Concurrent",
      ownerId: owner.id,
      members: {
        create: [
          { userId: owner.id, role: "MEMBER" },
          { userId: member.id, role: "ADMIN" },
          { userId: stranger.id, role: "ADMIN" },
        ],
      },
    },
  });
  const results = await Promise.all([
    manageFamily(db, family.id, member.id, "leave"),
    manageFamily(db, family.id, stranger.id, "leave"),
  ]);
  assert.equal(results.filter((result) => result.success).length, 1);
  assert.equal(
    results.filter((result) => result.error === "lastAdmin").length,
    1,
  );
  assert.equal(
    await db.familyMember.count({
      where: { familyId: family.id, role: "ADMIN" },
    }),
    1,
  );
});
test("archives and trash block sharing and preserve gifts and reservations; restoration is private", async () => {
  const list = await db.wishlist.create({
    data: {
      name: "Lifecycle",
      ownerId: owner.id,
      visibility: "LINK",
      shareToken: "b".repeat(64),
      items: { create: { title: "Gift" } },
    },
    include: { items: true },
  });
  const gift = list.items[0];
  await reserveGift(db, gift.id, member.id, list.shareToken);
  assert.equal(
    (await changeListState(db, list.id, stranger.id, "trash")).error,
    "forbidden",
  );
  assert.equal(
    (await changeListState(db, list.id, owner.id, "archive")).success,
    true,
  );
  assert.equal((await readWishlist(db, list.id, owner.id)).canEdit, false);
  assert.equal(
    await readWishlist(db, list.id, member.id, list.shareToken),
    null,
  );
  assert.equal(
    (await reserveGift(db, gift.id, stranger.id, list.shareToken)).error,
    "forbidden",
  );
  assert.equal(
    (await readMyReservations(db, member.id)).find((r) => r.itemId === gift.id)
      .gift,
    null,
  );
  await changeListState(db, list.id, owner.id, "trash");
  assert.equal(await readWishlist(db, list.id, owner.id), null);
  assert.equal(await db.reservation.count({ where: { itemId: gift.id } }), 1);
  await changeListState(db, list.id, owner.id, "restore");
  const restored = await db.wishlist.findUnique({ where: { id: list.id } });
  assert.equal(restored.visibility, "PRIVATE");
  assert.equal(restored.shareToken, null);
  assert.equal(restored.archivedAt, null);
  assert.equal(restored.deletedAt, null);
  assert.equal((await readWishlist(db, list.id, owner.id)).canEdit, true);
  assert.equal(await db.reservation.count({ where: { itemId: gift.id } }), 1);
});
test("duplicates have independent photos and gift IDs, with no reservations or share token", async () => {
  const image = randomUUID() + ".webp";
  fs.writeFileSync(path.join(photos, image), "immutable-photo");
  const list = await db.wishlist.create({
    data: {
      name: "Copy",
      ownerId: owner.id,
      visibility: "PUBLIC",
      shareToken: "c".repeat(64),
      items: { create: { title: "Photo", image, size: "M", priceCents: 4500 } },
    },
    include: { items: true },
  });
  await reserveGift(db, list.items[0].id, member.id);
  assert.equal(
    (await duplicateList(db, list.id, stranger.id, "Forbidden")).error,
    "forbidden",
  );
  const result = await duplicateList(db, list.id, owner.id, "New occasion");
  assert.equal(result.success, true);
  const copy = await db.wishlist.findUnique({
    where: { id: result.wishlistId },
    include: { items: { include: { reservations: true } } },
  });
  assert.equal(copy.visibility, "PRIVATE");
  assert.equal(copy.shareToken, null);
  assert.equal(copy.eventId, null);
  assert.notEqual(copy.items[0].id, list.items[0].id);
  assert.notEqual(copy.items[0].image, image);
  assert.deepEqual(copy.items[0].reservations, []);
  assert.equal(
    fs.readFileSync(path.join(photos, copy.items[0].image), "utf8"),
    "immutable-photo",
  );
  fs.unlinkSync(path.join(photos, image));
  assert.equal(fs.existsSync(path.join(photos, copy.items[0].image)), true);
  // Recreate original for backup consistency.
  fs.writeFileSync(path.join(photos, image), "immutable-photo");
});
test("gift trash preserves reservations and photos, hides gifts, and restores without revealing surprise", async () => {
  const image = randomUUID() + ".webp";
  fs.writeFileSync(path.join(photos, image), "kept-photo");
  const list = await db.wishlist.create({
    data: {
      name: "Gift trash",
      ownerId: owner.id,
      visibility: "PUBLIC",
      items: { create: { title: "Restorable", image } },
    },
    include: { items: true },
  });
  const gift = list.items[0];
  await reserveGift(db, gift.id, member.id);
  assert.equal(
    (await changeGiftState(db, gift.id, stranger.id)).error,
    "forbidden",
  );
  await changeGiftState(db, gift.id, owner.id);
  assert.equal(fs.readFileSync(path.join(photos, image), "utf8"), "kept-photo");
  assert.equal(
    (await db.wishlistItem.findUnique({ where: { id: gift.id } })).image,
    image,
  );
  assert.equal((await readWishlist(db, list.id, owner.id)).items.length, 0);
  assert.equal((await readWishlist(db, list.id, member.id)).items.length, 0);
  assert.equal(
    (await reserveGift(db, gift.id, stranger.id)).error,
    "forbidden",
  );
  assert.equal(
    (await readMyReservations(db, member.id)).find(
      (row) => row.itemId === gift.id,
    ).gift,
    null,
  );
  assert.equal((await readTrashedGifts(db, list.id, stranger.id)).length, 0);
  assert.deepEqual(
    Object.keys((await readTrashedGifts(db, list.id, owner.id))[0]).sort(),
    ["deletedAt", "id", "title"],
  );
  assert.equal(await db.reservation.count({ where: { itemId: gift.id } }), 1);
  const copy = await duplicateList(db, list.id, owner.id, "Only active gifts");
  assert.equal(
    await db.wishlistItem.count({ where: { wishlistId: copy.wishlistId } }),
    0,
  );
  await changeGiftState(db, gift.id, owner.id, true);
  const own = await readWishlist(db, list.id, owner.id);
  assert.equal(own.items[0].isReserved, false);
  assert.equal("reservations" in own.items[0], false);
  assert.equal(
    (await readWishlist(db, list.id, member.id)).items[0].reservedByMe,
    true,
  );
  await changeListState(db, list.id, owner.id, "archive");
  assert.equal(
    (await changeGiftState(db, gift.id, owner.id)).error,
    "forbidden",
  );
});
test("daily backups verify restoration, keep snapshots and record failures", async () => {
  const root = path.join(directory, "daily");
  const statusFile = path.join(directory, "status.json");
  const result = await dailyBackup({ database, photos, root, statusFile });
  assert.equal(result.restorationVerified, true);
  assert.equal(result.success, true);
  assert.equal(fs.existsSync(result.backup), true);
  assert.equal(
    fs.readdirSync(root).some((name) => name.startsWith(".restore-check-")),
    false,
  );
  await assert.rejects(() =>
    dailyBackup({
      database: path.join(directory, "missing.db"),
      photos,
      root,
      statusFile,
    }),
  );
  assert.equal(JSON.parse(fs.readFileSync(statusFile, "utf8")).success, false);
  assert.equal(fs.existsSync(result.backup), true);
});
test("external copy verifies files, rejects project destinations and preserves local backup if drive is absent", async () => {
  const root = path.join(directory, "daily-external"),
    externalRoot = path.join(directory, "external-drive"),
    projectRoot = path.join(directory, "project");
  fs.mkdirSync(externalRoot);
  fs.mkdirSync(projectRoot);
  const statusFile = path.join(directory, "external-status.json");
  const result = await dailyBackup({
    database,
    photos,
    root,
    statusFile,
    externalRoot,
    projectRoot,
  });
  assert.equal(result.externalCopy, "verified");
  assert.equal(fs.existsSync(result.externalBackup), true);
  assert.deepEqual(
    await verifyBackup(result.externalBackup),
    await verifyBackup(result.backup),
  );
  await assert.rejects(
    () => copyExternalBackup(result.backup, externalRoot, projectRoot),
    /EEXIST/,
  );
  await assert.rejects(
    () => copyExternalBackup(result.backup, projectRoot, projectRoot),
    /hors du dossier du projet/,
  );
  await assert.rejects(
    () => copyExternalBackup(result.backup, "relative-path", projectRoot),
    /chemin absolu/,
  );
  await assert.rejects(() =>
    dailyBackup({
      database,
      photos,
      root,
      statusFile,
      externalRoot: path.join(directory, "disconnected-drive"),
      projectRoot,
    }),
  );
  const failure = JSON.parse(fs.readFileSync(statusFile, "utf8"));
  assert.equal(failure.success, false);
  assert.equal(failure.externalCopy, "failed");
  assert.equal(failure.restorationVerified, true);
  assert.equal(fs.existsSync(failure.backup), true);
  assert.equal(fs.existsSync(result.externalBackup), true);
});
test("backup snapshot verifies all photos, detects tampering, and restores without overwriting", async () => {
  const destination = path.join(directory, "backup"),
    restored = path.join(directory, "restored");
  const made = await makeBackup({ database, photos, destination });
  assert.equal(made.photos, 3);
  assert.deepEqual(await verifyBackup(destination), made);
  await restoreBackup(destination, restored);
  assert.deepEqual(await verifyBackup(restored), made);
  await assert.rejects(() => restoreBackup(destination, restored), /EEXIST/);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(destination, "manifest.json"), "utf8"),
  );
  const image = manifest.entries.find((entry) =>
    entry.file.startsWith("photos/"),
  );
  fs.appendFileSync(path.join(destination, image.file), "tampered");
  await assert.rejects(() => verifyBackup(destination), /modifié ou incomplet/);
  // Traversal paths must be rejected before reading outside the backup.
  manifest.entries[0].file = "../outside.db";
  fs.writeFileSync(
    path.join(destination, "manifest.json"),
    JSON.stringify(manifest),
  );
  await assert.rejects(
    () => verifyBackup(destination),
    /Entrée de manifest invalide/,
  );
});
