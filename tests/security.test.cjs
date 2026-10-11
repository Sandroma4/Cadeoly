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
const {
  readWishlist,
  reserveGift,
  cancelGift,
} = require("../src/lib/wishlist-service.ts");
const { joinFamily } = require("../src/lib/invitation-service.ts");
const {
  itemSchema,
  wishlistSchema,
  registrationSchema,
  eventSchema,
} = require("../src/lib/validation.ts");
const { returnPath } = require("../src/lib/return-path.ts");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wishi-test-"));
const dbPath = path.join(directory, "test.db");
const db = new DatabaseSync(dbPath);
const baseline = fs.readFileSync(
  path.join(
    __dirname,
    "../prisma/migrations/202610030001_baseline/migration.sql",
  ),
  "utf8",
);
const upgrade = fs.readFileSync(
  path.join(
    __dirname,
    "../prisma/migrations/202610030002_secure_wishlists/migration.sql",
  ),
  "utf8",
);
db.exec(baseline);
db.exec(
  "INSERT INTO User (id,name,email,updatedAt) VALUES ('migration-user','Migration','migration@example.test',CURRENT_TIMESTAMP); INSERT INTO Wishlist (id,name,ownerId,updatedAt) VALUES ('migration-list','Migration','migration-user',CURRENT_TIMESTAMP); INSERT INTO WishlistItem (id,title,price,wishlistId,updatedAt) VALUES ('migration-gift','Migration',45.50,'migration-list',CURRENT_TIMESTAMP);",
);
db.exec(upgrade);
for (const folder of [
  "202610030003_query_indexes",
  "202610030004_gift_details_password_reset",
  "202610030005_accounts_families_list_lifecycle",
  "202610030006_gift_trash",
  "20261004110000_group_gifts_and_feedback",
  "202610070001_convenience",
  "202610090001_email_reminders_budgets",
  "202610100001_gift_preparation_favorites_order",
  "202610100002_account_tutorial",
  "202610100003_guest_reservations",
])
  db.exec(
    fs.readFileSync(
      path.join(__dirname, "../prisma/migrations", folder, "migration.sql"),
      "utf8",
    ),
  );
const migrated = db
  .prepare("SELECT priceCents FROM WishlistItem WHERE id='migration-gift'")
  .get().priceCents;
db.close();
const client = new PrismaClient({
  datasources: { db: { url: "file:" + dbPath.replaceAll("\\", "/") } },
});
let owner, member, stranger, invitee, family, list, gift;
before(async () => {
  [owner, member, stranger, invitee] = await Promise.all(
    ["owner", "member", "stranger", "invitee"].map((name) =>
      client.user.create({ data: { name, email: name + "@example.test" } }),
    ),
  );
  family = await client.family.create({
    data: {
      name: "Test family",
      ownerId: owner.id,
      members: {
        create: [{ userId: owner.id, role: "ADMIN" }, { userId: member.id }],
      },
    },
  });
  list = await client.wishlist.create({
    data: { name: "Private list", ownerId: owner.id, visibility: "PRIVATE" },
  });
  gift = await client.wishlistItem.create({
    data: { title: "Gift", wishlistId: list.id, priceCents: 1000 },
  });
});
after(async () => {
  await client.$disconnect();
  for (const name of ["test.db", "test.db-wal", "test.db-shm"]) {
    const target = path.join(directory, name);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
  fs.rmdirSync(directory);
});
test("migration preserves prices in cents", () => assert.equal(migrated, 4550));
test("private lists cannot be read or reserved by another account", async () => {
  assert.ok(await readWishlist(client, list.id, owner.id));
  assert.equal(await readWishlist(client, list.id, member.id), null);
  assert.equal(await readWishlist(client, list.id), null);
  assert.deepEqual(await reserveGift(client, gift.id, stranger.id), {
    error: "forbidden",
  });
  assert.deepEqual(await reserveGift(client, gift.id, owner.id), {
    error: "forbidden",
  });
});
test("family access, reservation uniqueness, surprise and cancellation ownership", async () => {
  await client.wishlist.update({
    where: { id: list.id },
    data: { visibility: "FAMILY" },
  });
  assert.ok(await readWishlist(client, list.id, member.id));
  assert.equal(await readWishlist(client, list.id, stranger.id), null);
  const results = await Promise.all([
    reserveGift(client, gift.id, member.id),
    reserveGift(client, gift.id, member.id),
  ]);
  assert.equal(results.filter((r) => r.success).length, 1);
  assert.equal(results.filter((r) => r.error === "alreadyReserved").length, 1);
  const mine = await readWishlist(client, list.id, owner.id);
  assert.equal(mine.items[0].isReserved, false);
  assert.equal(mine.items[0].reservedByMe, false);
  assert.equal("reservations" in mine.items[0], false);
  assert.equal(JSON.stringify(mine).includes(member.id), false);
  const theirs = await readWishlist(client, list.id, member.id);
  assert.equal(theirs.items[0].reservedByMe, true);
  assert.equal("reservations" in theirs.items[0], false);
  assert.deepEqual(await cancelGift(client, gift.id, stranger.id), {
    error: "forbidden",
  });
  assert.deepEqual(await cancelGift(client, gift.id, member.id), {
    success: true,
  });
});
test("link access requires current token, renewal and revocation work", async () => {
  await client.wishlist.update({
    where: { id: list.id },
    data: { visibility: "LINK", shareToken: "first" },
  });
  assert.equal(await readWishlist(client, list.id, member.id), null);
  assert.equal(await readWishlist(client, list.id, undefined, "wrong"), null);
  assert.ok(await readWishlist(client, list.id, undefined, "first"));
  assert.deepEqual(await reserveGift(client, gift.id, member.id), {
    error: "forbidden",
  });
  assert.deepEqual(await reserveGift(client, gift.id, member.id, "first"), {
    success: true,
  });
  await cancelGift(client, gift.id, member.id);
  await client.wishlist.update({
    where: { id: list.id },
    data: { shareToken: "second" },
  });
  assert.equal(await readWishlist(client, list.id, undefined, "first"), null);
  await client.wishlist.update({
    where: { id: list.id },
    data: { shareToken: null },
  });
  assert.equal(await readWishlist(client, list.id, undefined, "second"), null);
});
test("invitations check recipient, expire, and are consumed once", async () => {
  await client.invitation.create({
    data: {
      email: invitee.email,
      familyId: family.id,
      token: "personal",
      expires: new Date(Date.now() + 60000),
    },
  });
  assert.deepEqual(await joinFamily(client, "personal", stranger), {
    error: "wrongEmail",
  });
  assert.ok(
    await client.invitation.findUnique({ where: { token: "personal" } }),
  );
  assert.equal((await joinFamily(client, "personal", invitee)).success, true);
  assert.deepEqual(await joinFamily(client, "personal", invitee), {
    error: "invalidInvitation",
  });
  await client.invitation.create({
    data: {
      email: stranger.email,
      familyId: family.id,
      token: "expired",
      expires: new Date(Date.now() - 1000),
    },
  });
  assert.deepEqual(await joinFamily(client, "expired", stranger), {
    error: "invalidInvitation",
  });
});
test("failed invitation consumption rolls back membership creation", async () => {
  await client.invitation.create({
    data: {
      email: stranger.email,
      familyId: family.id,
      token: "rollback",
      expires: new Date(Date.now() + 60000),
    },
  });
  await client.$executeRawUnsafe(
    "CREATE TRIGGER prevent_invite_delete BEFORE DELETE ON Invitation WHEN OLD.token = 'rollback' BEGIN SELECT RAISE(ABORT, 'test rollback'); END",
  );
  await assert.rejects(() => joinFamily(client, "rollback", stranger));
  assert.equal(
    await client.familyMember.findUnique({
      where: { userId_familyId: { userId: stranger.id, familyId: family.id } },
    }),
    null,
  );
  assert.ok(
    await client.invitation.findUnique({ where: { token: "rollback" } }),
  );
  await client.$executeRawUnsafe("DROP TRIGGER prevent_invite_delete");
});
test("server validation rejects unsafe and invalid form input", () => {
  const input = {
    title: " Gift ",
    price: "45.50",
    priority: "NORMAL",
    url: "https://example.test",
  };
  assert.equal(itemSchema.parse(input).price, 4550);
  assert.equal(itemSchema.parse({ ...input, price: "0" }).price, 0);
  for (const price of ["-1", "NaN", "0.001", "1e10"])
    assert.equal(itemSchema.safeParse({ ...input, price }).success, false);
  assert.equal(
    itemSchema.safeParse({ ...input, url: "javascript:alert(1)" }).success,
    false,
  );
  assert.equal(
    wishlistSchema.safeParse({ name: "list", visibility: "EVERYONE" }).success,
    false,
  );
  assert.equal(
    registrationSchema.safeParse({
      name: "Name",
      email: "bad",
      password: "short",
    }).success,
    false,
  );
  assert.equal(
    eventSchema.safeParse({
      name: "Event",
      familyId: "family",
      date: "2026-02-30",
    }).success,
    false,
  );
});
test("login return path rejects external URLs", () => {
  assert.equal(returnPath("https://evil.test", "fr"), "/fr/dashboard");
  assert.equal(returnPath("//evil.test", "en"), "/en/dashboard");
  assert.equal(returnPath("/fr/invite/abc", "fr"), "/fr/invite/abc");
});

test("public lists can be viewed anonymously, private data stays protected", async () => {
  await client.wishlist.update({
    where: { id: list.id },
    data: { visibility: "PUBLIC" },
  });
  assert.ok(await readWishlist(client, list.id));
  assert.deepEqual(await reserveGift(client, gift.id, stranger.id), {
    success: true,
  });
  assert.deepEqual(await cancelGift(client, gift.id, stranger.id), {
    success: true,
  });
});
test("password validation avoids bcrypt truncation and preserves invite/share return routes", () => {
  assert.equal(
    registrationSchema.safeParse({
      name: "Test",
      email: "test@example.test",
      password: "a".repeat(73),
    }).success,
    false,
  );
  assert.equal(
    registrationSchema.safeParse({
      name: "Test",
      email: "test@example.test",
      password: "é".repeat(40),
    }).success,
    false,
  );
  assert.equal(returnPath("/en/lists/abc", "en"), "/en/lists/abc");
});
