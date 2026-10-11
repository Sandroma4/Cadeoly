require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { PrismaClient } = require("@wishi/prisma-client");
const {
  duplicateEventWithLists,
} = require("../src/lib/event-duplicate-service.ts");
const { moveGift } = require("../src/lib/gift-order-service.ts");
const { readWishlist } = require("../src/lib/wishlist-service.ts");
const { giftPageOptions } = require("../src/lib/gift-search.ts");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cadeoly-event-order-"));
const oldUpload = process.env.UPLOAD_DIR;
process.env.UPLOAD_DIR = path.join(dir, "photos");
fs.mkdirSync(process.env.UPLOAD_DIR);
const file = path.join(dir, "test.db"),
  sql = new DatabaseSync(file);
for (const migration of fs
  .readdirSync(path.join(__dirname, "../prisma/migrations"))
  .filter((n) => /^\d/.test(n))
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
let owner, member, outsider, event, list, gifts, photo;
before(async () => {
  owner = await db.user.create({ data: { name: "Owner" } });
  member = await db.user.create({ data: { name: "Member" } });
  outsider = await db.user.create({ data: { name: "Outsider" } });
  const family = await db.family.create({
    data: {
      name: "Family",
      ownerId: owner.id,
      members: {
        create: [{ userId: owner.id, role: "ADMIN" }, { userId: member.id }],
      },
    },
  });
  event = await db.event.create({
    data: { name: "Source", date: new Date("2030-01-01"), familyId: family.id },
  });
  photo = randomUUID() + ".webp";
  fs.writeFileSync(path.join(process.env.UPLOAD_DIR, photo), "photo-bytes");
  const recipient = await db.recipient.create({
    data: { ownerId: member.id, name: "Child" },
  });
  list = await db.wishlist.create({
    data: {
      name: "My list",
      ownerId: member.id,
      eventId: event.id,
      visibility: "LINK",
      shareToken: "original-token",
      recipientId: recipient.id,
      items: {
        create: Array.from({ length: 26 }, (_, position) => ({
          title: "Gift " + position,
          position,
          image: position === 0 ? photo : null,
          priceCents: 1000,
          isGroupGift: position === 1,
        })),
      },
    },
  });
  gifts = await db.wishlistItem.findMany({
    where: { wishlistId: list.id },
    orderBy: { position: "asc" },
  });
  await db.reservation.create({
    data: { itemId: gifts[0].id, userId: owner.id },
  });
  await db.contribution.create({
    data: { itemId: gifts[1].id, userId: owner.id, amountCents: 100 },
  });
  for (const data of [
    { ownerId: owner.id },
    { ownerId: member.id, archivedAt: new Date() },
    { ownerId: member.id, deletedAt: new Date() },
  ])
    await db.wishlist.create({
      data: { name: "Excluded", eventId: event.id, ...data },
    });
});
after(async () => {
  await db.$disconnect();
  if (oldUpload === undefined) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = oldUpload;
  fs.rmSync(dir, { recursive: true, force: true });
});
test("member duplicates own active lists atomically, with private copies and independent photos, no gift signals", async () => {
  assert.equal(
    (
      await duplicateEventWithLists(db, event.id, outsider.id, {
        name: "No",
        date: "2031-01-01",
      })
    ).error,
    "forbidden",
  );
  assert.equal(
    (
      await duplicateEventWithLists(db, event.id, member.id, {
        name: "Bad",
        date: "2031-02-30",
      })
    ).error,
    "invalidFields",
  );
  const result = await duplicateEventWithLists(db, event.id, member.id, {
    name: "Next",
    date: "2031-01-01",
  });
  assert.equal(result.success, true);
  const copied = await db.event.findUnique({
    where: { id: result.eventId },
    include: {
      wishlists: {
        include: {
          items: { include: { reservations: true, contributions: true } },
        },
      },
    },
  });
  assert.equal(copied.familyId, event.familyId);
  assert.equal(copied.name, "Next");
  assert.equal(copied.wishlists.length, 1);
  const copy = copied.wishlists[0];
  assert.equal(copy.ownerId, member.id);
  assert.equal(copy.visibility, "PRIVATE");
  assert.equal(copy.shareToken, null);
  assert.equal(copy.items.length, 26);
  assert.equal(copy.recipientId, list.recipientId);
  assert.ok(
    copy.items.every((i) => !i.reservations.length && !i.contributions.length),
  );
  const image = copy.items.find((i) => i.title === "Gift 0").image;
  assert.notEqual(image, photo);
  assert.equal(
    fs.readFileSync(path.join(process.env.UPLOAD_DIR, image), "utf8"),
    "photo-bytes",
  );
  assert.equal(copy.items.find((i) => i.title === "Gift 25").position, 25);
});
test("failed photo copy rolls back new event and lists and removes already copied photos", async () => {
  const broken = await db.wishlist.create({
    data: {
      name: "Broken",
      ownerId: member.id,
      eventId: event.id,
      items: {
        create: [
          { title: "valid", image: photo },
          { title: "missing", image: randomUUID() + ".webp" },
        ],
      },
    },
  });
  const beforePhotos = fs.readdirSync(process.env.UPLOAD_DIR).sort();
  const count = await db.event.count();
  assert.equal(
    (
      await duplicateEventWithLists(db, event.id, member.id, {
        name: "Rollback",
        date: "2032-01-01",
      })
    ).error,
    "unexpected",
  );
  assert.equal(await db.event.count(), count);
  assert.deepEqual(fs.readdirSync(process.env.UPLOAD_DIR).sort(), beforePhotos);
  await db.wishlist.delete({ where: { id: broken.id } });
});
test("manual moves enforce ownership, cross filters/pages, persist and serialize concurrent moves", async () => {
  assert.equal(
    (await moveGift(db, gifts[1].id, owner.id, "up")).error,
    "forbidden",
  );
  assert.equal(
    (await moveGift(db, gifts[1].id, member.id, "invalid")).error,
    "invalidFields",
  );
  assert.equal(
    (await moveGift(db, gifts[24].id, member.id, "up")).success,
    true,
  );
  let result = await readWishlist(
    db,
    list.id,
    member.id,
    undefined,
    giftPageOptions({ q: "Gift 24" }, "fr"),
  );
  assert.equal(result.items[0].position, 23);
  assert.equal(result.items[0].canMoveUp, true);
  assert.equal(result.items[0].canMoveDown, true);
  result = await readWishlist(
    db,
    list.id,
    member.id,
    undefined,
    giftPageOptions({}, "en"),
  );
  assert.equal(result.items[23].id, gifts[24].id);
  const concurrent = await Promise.all([
    moveGift(db, gifts[2].id, member.id, "up"),
    moveGift(db, gifts[2].id, member.id, "up"),
  ]);
  assert.ok(
    concurrent.every((r) => r.success),
    JSON.stringify(concurrent),
  );
  result = await readWishlist(db, list.id, member.id);
  assert.equal(result.items[0].id, gifts[2].id);
  assert.equal(result.items[0].canMoveUp, false);
  assert.equal(new Set(result.items.map((i) => i.position)).size, 26);
  await db.wishlist.update({
    where: { id: list.id },
    data: { archivedAt: new Date() },
  });
  assert.equal(
    (await moveGift(db, gifts[0].id, member.id, "down")).error,
    "forbidden",
  );
});

test("list and event copies preserve tied positions by original createdAt and id order", async () => {
  const { duplicateList } = require("../src/lib/list-lifecycle-service.ts");
  const prefix = randomUUID();
  const source = await db.wishlist.create({
    data: {
      name: "Tied order",
      ownerId: member.id,
      eventId: event.id,
      items: {
        create: [
          {
            id: prefix + "z",
            title: "Oldest",
            position: 0,
            createdAt: new Date("2030-01-01"),
          },
          {
            id: prefix + "b",
            title: "Newest B",
            position: 0,
            createdAt: new Date("2030-01-03"),
          },
          {
            id: prefix + "a",
            title: "Newest A",
            position: 0,
            createdAt: new Date("2030-01-03"),
          },
          {
            id: prefix + "c",
            title: "Middle",
            position: 0,
            createdAt: new Date("2030-01-02"),
          },
        ],
      },
    },
  });
  const expected = (await readWishlist(db, source.id, member.id)).items.map(
    (item) => item.title,
  );
  assert.deepEqual(expected, ["Newest A", "Newest B", "Middle", "Oldest"]);
  const direct = await duplicateList(db, source.id, member.id, "Direct copy");
  assert.equal(direct.success, true);
  const eventCopy = await duplicateEventWithLists(db, event.id, member.id, {
    name: "Copy ties",
    date: "2034-01-01",
  });
  assert.equal(eventCopy.success, true);
  const attached = await db.wishlist.findFirstOrThrow({
    where: { eventId: eventCopy.eventId, name: source.name },
  });
  for (const id of [direct.wishlistId, attached.id]) {
    const copy = await readWishlist(db, id, member.id);
    assert.deepEqual(
      copy.items.map((item) => item.title),
      expected,
    );
    assert.deepEqual(
      copy.items.map((item) => item.position),
      [0, 1, 2, 3],
    );
  }
});
