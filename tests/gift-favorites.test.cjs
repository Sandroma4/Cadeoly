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
const { readGiftIdeas } = require("../src/lib/gift-ideas.ts");
const { setGiftFavorite } = require("../src/lib/gift-favorites.ts");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wishi-favorites-"));
const file = path.join(directory, "test.db");
const sql = new DatabaseSync(file);
for (const migration of fs
  .readdirSync(path.join(__dirname, "../prisma/migrations"))
  .filter((name) => /^\d/.test(name))
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
  fs.rmSync(directory, { recursive: true, force: true });
});
test("favorites are private, idempotent, survive reservation, and never bypass current access", async () => {
  const owner = await db.user.create({ data: { name: "Owner" } });
  const buyer = await db.user.create({ data: { name: "Buyer" } });
  const other = await db.user.create({ data: { name: "Other" } });
  const family = await db.family.create({
    data: {
      name: "Family",
      ownerId: owner.id,
      members: {
        create: [owner, buyer, other].map((user) => ({ userId: user.id })),
      },
    },
  });
  const list = await db.wishlist.create({
    data: { name: "Ideas", ownerId: owner.id, visibility: "FAMILY" },
  });
  const gift = await db.wishlistItem.create({
    data: { title: "Book", wishlistId: list.id },
  });
  assert.deepEqual(await setGiftFavorite(db, gift.id, owner.id, true), {
    error: "forbidden",
  });
  assert.deepEqual(await setGiftFavorite(db, gift.id, buyer.id, true), {
    success: true,
  });
  await setGiftFavorite(db, gift.id, buyer.id, true);
  assert.equal(await db.giftFavorite.count(), 1);
  assert.equal((await readGiftIdeas(db, buyer.id))[0].isFavorite, true);
  assert.equal((await readGiftIdeas(db, other.id))[0].isFavorite, false);
  await db.reservation.create({ data: { itemId: gift.id, userId: other.id } });
  assert.equal((await readGiftIdeas(db, buyer.id))[0].isReserved, true);
  assert.equal((await readGiftIdeas(db, other.id)).length, 0);
  for (const data of [
    { visibility: "PRIVATE" },
    { visibility: "FAMILY", archivedAt: new Date() },
    { archivedAt: null, deletedAt: new Date() },
  ]) {
    await db.wishlist.update({ where: { id: list.id }, data });
    assert.equal((await readGiftIdeas(db, buyer.id)).length, 0);
    assert.deepEqual(await setGiftFavorite(db, gift.id, buyer.id, true), {
      error: "forbidden",
    });
  }
  await db.wishlist.update({
    where: { id: list.id },
    data: { deletedAt: null },
  });
  await db.wishlistItem.update({
    where: { id: gift.id },
    data: { deletedAt: new Date() },
  });
  assert.equal((await readGiftIdeas(db, buyer.id)).length, 0);
  await db.wishlistItem.update({
    where: { id: gift.id },
    data: { deletedAt: null },
  });
  await db.familyMember.delete({
    where: { userId_familyId: { userId: buyer.id, familyId: family.id } },
  });
  assert.equal((await readGiftIdeas(db, buyer.id)).length, 0);
  assert.deepEqual(await setGiftFavorite(db, gift.id, buyer.id, true), {
    error: "forbidden",
  });
  assert.deepEqual(await setGiftFavorite(db, gift.id, buyer.id, false), {
    success: true,
  });
  assert.equal(await db.giftFavorite.count(), 0);
});

test("older favorites survive the discovery limit and still enforce current access", async () => {
  const owner = await db.user.create({ data: { name: "Catalog owner" } });
  const buyer = await db.user.create({ data: { name: "Catalog buyer" } });
  await db.family.create({
    data: {
      name: "Catalog family",
      ownerId: owner.id,
      members: { create: [{ userId: owner.id }, { userId: buyer.id }] },
    },
  });
  const list = await db.wishlist.create({
    data: { name: "Catalog", ownerId: owner.id, visibility: "FAMILY" },
  });
  const oldGift = await db.wishlistItem.create({
    data: {
      title: "Old favorite",
      wishlistId: list.id,
      createdAt: new Date("2020-01-01"),
    },
  });
  await setGiftFavorite(db, oldGift.id, buyer.id, true);
  await db.$transaction(
    Array.from({ length: 501 }, (_, index) =>
      db.wishlistItem.create({
        data: {
          title: `New idea ${index}`,
          wishlistId: list.id,
          createdAt: new Date("2025-01-01"),
        },
      }),
    ),
  );
  const ideas = await readGiftIdeas(db, buyer.id);
  assert.equal(ideas.length, 501);
  assert.equal(ideas.find((item) => item.id === oldGift.id)?.isFavorite, true);
  assert.equal(new Set(ideas.map((item) => item.id)).size, ideas.length);
  await db.wishlist.update({
    where: { id: list.id },
    data: { visibility: "PRIVATE" },
  });
  assert.equal((await readGiftIdeas(db, buyer.id)).length, 0);
});
