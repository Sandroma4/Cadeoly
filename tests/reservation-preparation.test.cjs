require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { PrismaClient } = require("@wishi/prisma-client");
const {
  reserveGift,
  readWishlist,
  readMyReservations,
} = require("../src/lib/wishlist-service.ts");
const {
  updatePreparation,
  cancelWithUndo,
  undoCancellation,
} = require("../src/lib/reservation-preparation.ts");
const { changeGiftState } = require("../src/lib/gift-lifecycle-service.ts");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wishi-preparation-"));
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
let owner, buyer, other, list, gift;
test("a linked personal note is released only when its account holder marks the gift given", async () => {
  const item = await db.wishlistItem.create({
    data: { title: "Personal gift", wishlistId: list.id },
  });
  await reserveGift(db, item.id, buyer.id, list.shareToken);
  await db.reservation.update({
    where: { itemId: item.id },
    data: { personalMessage: "Birthday note" },
  });
  assert.equal(
    (await updatePreparation(db, item.id, other.id, "GIVEN")).error,
    "forbidden",
  );
  assert.equal(
    (await db.reservation.findUnique({ where: { itemId: item.id } }))
      .messageReleasedAt,
    null,
  );
  assert.equal(
    (await updatePreparation(db, item.id, buyer.id, "GIVEN")).success,
    true,
  );
  assert.ok(
    (await db.reservation.findUnique({ where: { itemId: item.id } }))
      .messageReleasedAt,
  );
  const cancelled = await cancelWithUndo(db, item.id, buyer.id);
  assert.equal(
    (await undoCancellation(db, item.id, buyer.id, cancelled.undo)).success,
    true,
  );
  assert.equal(
    (await db.reservation.findUnique({ where: { itemId: item.id } }))
      .personalMessage,
    "Birthday note",
  );
});
before(async () => {
  [owner, buyer, other] = await Promise.all(
    ["owner", "buyer", "other"].map((name) =>
      db.user.create({ data: { name } }),
    ),
  );
  list = await db.wishlist.create({
    data: {
      name: "Private preparation",
      ownerId: owner.id,
      visibility: "LINK",
      shareToken: "preparation-link",
    },
  });
  gift = await db.wishlistItem.create({
    data: { title: "Book", wishlistId: list.id },
  });
});
after(async () => {
  await db.$disconnect();
  fs.rmSync(directory, { recursive: true, force: true });
});
test("preparation is buyer-only and absent from owner and visitor wishlist DTOs", async () => {
  assert.equal(
    (await reserveGift(db, gift.id, buyer.id, list.shareToken)).success,
    true,
  );
  for (const status of ["RESERVED", "BOUGHT", "WRAPPED", "GIVEN"]) {
    assert.equal(
      (await updatePreparation(db, gift.id, buyer.id, status)).success,
      true,
    );
    assert.equal(
      (await readMyReservations(db, buyer.id))[0].preparationStatus,
      status,
    );
  }
  for (const user of [owner, other])
    assert.equal(
      (await updatePreparation(db, gift.id, user.id, "BOUGHT")).error,
      "forbidden",
    );
  assert.equal(
    (await updatePreparation(db, gift.id, buyer.id, "bad")).error,
    "invalidFields",
  );
  for (const user of [owner, other]) {
    const dto = await readWishlist(db, list.id, user.id, list.shareToken);
    assert.equal(JSON.stringify(dto).includes("preparationStatus"), false);
    assert.equal(JSON.stringify(dto).includes("GIVEN"), false);
  }
});
test("cancel undo preserves preparation and respects uniqueness and current access", async () => {
  await db.reservation.update({
    where: { itemId: gift.id },
    data: { quantity: 2 },
  });
  assert.equal(
    (await cancelWithUndo(db, gift.id, other.id)).error,
    "forbidden",
  );
  const cancelled = await cancelWithUndo(db, gift.id, buyer.id);
  assert.equal(cancelled.undo.preparationStatus, "GIVEN");
  assert.equal(
    (await undoCancellation(db, gift.id, buyer.id, cancelled.undo)).success,
    true,
  );
  assert.equal(
    (await readMyReservations(db, buyer.id))[0].preparationStatus,
    "GIVEN",
  );
  assert.equal((await readMyReservations(db, buyer.id))[0].gift.quantity, 2);
  const again = await cancelWithUndo(db, gift.id, buyer.id);
  await reserveGift(db, gift.id, other.id, list.shareToken);
  assert.equal(
    (await undoCancellation(db, gift.id, buyer.id, again.undo)).error,
    "alreadyReserved",
  );
  assert.equal(
    (await db.reservation.findUnique({ where: { itemId: gift.id } })).userId,
    other.id,
  );
  await cancelWithUndo(db, gift.id, other.id);
  await db.wishlist.update({
    where: { id: list.id },
    data: { shareToken: "rotated" },
  });
  assert.equal(
    (await undoCancellation(db, gift.id, buyer.id, again.undo)).error,
    "forbidden",
  );
  assert.equal(await db.reservation.count({ where: { itemId: gift.id } }), 0);
});
test("gift deletion undo restores only an active list owner's gift and preserves reservations", async () => {
  const ownList = await db.wishlist.create({
    data: { name: "Undo list", ownerId: owner.id, visibility: "PUBLIC" },
  });
  const ownGift = await db.wishlistItem.create({
    data: { title: "Undo gift", wishlistId: ownList.id },
  });
  await reserveGift(db, ownGift.id, buyer.id);
  await updatePreparation(db, ownGift.id, buyer.id, "WRAPPED");
  assert.equal((await changeGiftState(db, ownGift.id, owner.id)).success, true);
  assert.equal(
    (await changeGiftState(db, ownGift.id, other.id, true)).error,
    "forbidden",
  );
  assert.equal((await readMyReservations(db, buyer.id))[0].gift, null);
  assert.equal(
    (await changeGiftState(db, ownGift.id, owner.id, true)).success,
    true,
  );
  assert.equal(
    (await readMyReservations(db, buyer.id))[0].preparationStatus,
    "WRAPPED",
  );
  await changeGiftState(db, ownGift.id, owner.id);
  await db.wishlist.update({
    where: { id: ownList.id },
    data: { archivedAt: new Date() },
  });
  assert.equal(
    (await changeGiftState(db, ownGift.id, owner.id, true)).error,
    "forbidden",
  );
});
test("revoked access cannot return a replacement share token on cancellation", async () => {
  await reserveGift(db, gift.id, buyer.id, "rotated");
  await db.wishlist.update({
    where: { id: list.id },
    data: { shareToken: "secret-new-token" },
  });
  assert.equal(
    (await updatePreparation(db, gift.id, buyer.id, "BOUGHT")).error,
    "forbidden",
  );
  const cancelled = await cancelWithUndo(db, gift.id, buyer.id);
  assert.equal(cancelled.undo.token, undefined);
  assert.equal(
    (await undoCancellation(db, gift.id, buyer.id, cancelled.undo)).error,
    "forbidden",
  );
});
