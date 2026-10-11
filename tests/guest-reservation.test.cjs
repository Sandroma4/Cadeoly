require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  guestReservationSchema,
  managementToken,
  ownsGuestReservation,
} = require("../src/lib/guest-reservation-service.ts");
const { reserveGuestGift } = require("../src/lib/guest-reservation-service.ts");
const { reserveGift, readWishlist } = require("../src/lib/wishlist-service.ts");
test("migration preserves registered reservations and their preparation", () => {
  const fs = require("node:fs"),
    path = require("node:path"),
    { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(":memory:"),
    directory = path.join(__dirname, "../prisma/migrations");
  try {
    const migrations = fs
        .readdirSync(directory)
        .filter((n) => /^\d/.test(n))
        .sort(),
      last = migrations.find((n) => n.endsWith("_guest_reservations"));
    for (const migration of migrations.filter((n) => n !== last))
      db.exec(
        fs.readFileSync(
          path.join(directory, migration, "migration.sql"),
          "utf8",
        ),
      );
    db.exec(`INSERT INTO User(id,name,updatedAt) VALUES ('owner','Owner',CURRENT_TIMESTAMP),('buyer','Buyer',CURRENT_TIMESTAMP);
      INSERT INTO Wishlist(id,name,ownerId,updatedAt) VALUES('list','List','owner',CURRENT_TIMESTAMP);
      INSERT INTO WishlistItem(id,title,wishlistId,updatedAt) VALUES('item','Book','list',CURRENT_TIMESTAMP);
      INSERT INTO Reservation(id,itemId,userId,quantity,preparationStatus,updatedAt) VALUES('reservation','item','buyer',2,'WRAPPED',CURRENT_TIMESTAMP);`);
    db.exec(
      fs.readFileSync(path.join(directory, last, "migration.sql"), "utf8"),
    );
    const row = db
      .prepare("SELECT * FROM Reservation WHERE id='reservation'")
      .get();
    assert.equal(row.userId, "buyer");
    assert.equal(row.quantity, 2);
    assert.equal(row.preparationStatus, "WRAPPED");
    assert.equal(row.guestEmail, null);
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  } finally {
    db.close();
  }
});
test("guest inputs are minimal, normalized and bounded", () => {
  assert.equal(
    guestReservationSchema.parse({
      firstName: " Lou ",
      email: "LOU@example.test",
      message: "",
    }).email,
    "lou@example.test",
  );
  assert.equal(
    guestReservationSchema.safeParse({ firstName: "", email: "invalid" })
      .success,
    false,
  );
  assert.equal(
    guestReservationSchema.safeParse({
      firstName: "Lou",
      email: "lou@example.test",
      message: "x".repeat(1001),
    }).success,
    false,
  );
});
test("guest reservations enforce sharing, uniqueness, retry ownership and private DTOs in SQLite", async () => {
  const fs = require("node:fs"),
    os = require("node:os"),
    path = require("node:path");
  const { DatabaseSync } = require("node:sqlite"),
    { PrismaClient } = require("@wishi/prisma-client");
  const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "cadeoly-guest-test-"),
    ),
    file = path.join(directory, "test.db");
  const sql = new DatabaseSync(file);
  for (const migration of fs
    .readdirSync(path.join(__dirname, "../prisma/migrations"))
    .filter((n) => /^\d/.test(n))
    .sort())
    sql.exec(
      fs.readFileSync(
        path.join(
          __dirname,
          "../prisma/migrations",
          migration,
          "migration.sql",
        ),
        "utf8",
      ),
    );
  sql.close();
  const db = new PrismaClient({
    datasources: { db: { url: "file:" + file.replaceAll("\\", "/") } },
  });
  try {
    const owner = await db.user.create({ data: { name: "Owner" } }),
      buyer = await db.user.create({ data: { name: "Buyer" } });
    const list = await db.wishlist.create({
      data: {
        name: "Birthday",
        ownerId: owner.id,
        visibility: "LINK",
        shareToken: "shared",
        items: { create: { title: "Book" } },
      },
      include: { items: true },
    });
    const item = list.items[0],
      input = {
        firstName: "Lou",
        email: "lou@example.test",
        message: "Happy birthday!",
      };
    assert.equal(
      (await reserveGuestGift(db, item.id, "wrong", input, "session", "secret"))
        .error,
      "forbidden",
    );
    const guest = await reserveGuestGift(
      db,
      item.id,
      "shared",
      input,
      "session",
      "secret",
    );
    assert.ok(guest.id);
    assert.equal(
      (
        await reserveGuestGift(
          db,
          item.id,
          "shared",
          input,
          "session",
          "secret",
        )
      ).id,
      guest.id,
    );
    assert.equal(
      (await reserveGuestGift(db, item.id, "shared", input, "other", "secret"))
        .error,
      "alreadyReserved",
    );
    assert.equal(
      (await reserveGift(db, item.id, buyer.id, "shared")).error,
      "alreadyReserved",
    );
    const dto = await readWishlist(db, list.id, undefined, "shared");
    assert.equal(dto.items[0].isReserved, true);
    for (const forbidden of [
      "guestEmail",
      "guestFirstName",
      "personalMessage",
      "managementTokenHash",
      "guestSessionHash",
      "reservations",
    ])
      assert.equal(JSON.stringify(dto).includes(forbidden), false);
    await db.reservation.delete({ where: { id: guest.id } });
    assert.equal(
      (await reserveGift(db, item.id, buyer.id, "shared")).success,
      true,
    );
    await db.wishlist.update({
      where: { id: list.id },
      data: { archivedAt: new Date() },
    });
    assert.equal(
      (
        await reserveGuestGift(
          db,
          item.id,
          "shared",
          input,
          "session",
          "secret",
        )
      ).error,
      "forbidden",
    );
    await db.wishlist.update({
      where: { id: list.id },
      data: { archivedAt: null, visibility: "PRIVATE" },
    });
    assert.equal(
      (
        await reserveGuestGift(
          db,
          item.id,
          "shared",
          input,
          "session",
          "secret",
        )
      ).error,
      "forbidden",
    );
  } finally {
    await db.$disconnect();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test("management credentials are scoped to one reservation and session ownership is explicit", () => {
  assert.notEqual(
    managementToken("one", "secret"),
    managementToken("two", "secret"),
  );
  assert.notEqual(
    managementToken("one", "secret"),
    managementToken("one", "other"),
  );
  assert.equal(
    ownsGuestReservation({ guestSessionHash: "a", userId: null }, "a"),
    true,
  );
  assert.equal(
    ownsGuestReservation({ guestSessionHash: "a", userId: null }, "b"),
    false,
  );
  assert.equal(
    ownsGuestReservation({ guestSessionHash: null, userId: null }, undefined),
    false,
  );
  assert.equal(
    ownsGuestReservation({ guestSessionHash: "a", userId: "account" }, "a"),
    false,
  );
});
