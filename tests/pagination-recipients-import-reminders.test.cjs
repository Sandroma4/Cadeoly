require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test, before, after } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { DatabaseSync } = require("node:sqlite"),
  { PrismaClient } = require("@wishi/prisma-client");
const { manageRecipient } = require("../src/lib/recipient-service.ts");
const {
  parsePersonalExport,
  importPersonalExport,
} = require("../src/lib/personal-import.ts");
const { readReminders } = require("../src/lib/reminders.ts");
const { checkMerchantLink } = require("../src/lib/merchant-links.ts");
const { paginateGifts } = require("../src/lib/gift-search.ts");
const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "cadeoly-improvements-"),
  ),
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
let owner, stranger;
test("pagination bounds page requests and shows every filtered gift exactly once", () => {
  const items = Array.from({ length: 49 }, (_, id) => id);
  assert.deepEqual(
    [1, 2, 3].flatMap((page) => paginateGifts(items, page).items),
    items,
  );
  assert.equal(paginateGifts(items, 99).page, 3);
  assert.equal(paginateGifts([], -1).page, 1);
  assert.equal(paginateGifts(items, NaN).page, 1);
});
before(async () => {
  [owner, stranger] = await Promise.all(
    ["owner", "stranger"].map((name) =>
      db.user.create({ data: { name, email: `${name}@test.example` } }),
    ),
  );
});
after(async () => {
  await db.$disconnect();
  if (
    path.dirname(directory) === os.tmpdir() &&
    path.basename(directory).startsWith("cadeoly-improvements-")
  )
    fs.rmSync(directory, { recursive: true, force: true });
});
test("recipient changes are owner-only; merge moves lists and deletion preserves them", async () => {
  const a = await db.recipient.create({
      data: { name: "Child", ownerId: owner.id },
    }),
    b = await db.recipient.create({
      data: { name: "Duplicate", ownerId: owner.id },
    });
  const list = await db.wishlist.create({
    data: { name: "Child list", ownerId: owner.id, recipientId: a.id },
  });
  assert.equal(
    (
      await manageRecipient(db, stranger.id, a.id, {
        operation: "rename",
        name: "Wrong",
      })
    ).error,
    "forbidden",
  );
  assert.ok(
    (
      await manageRecipient(db, owner.id, a.id, {
        operation: "rename",
        name: "Updated",
      })
    ).success,
  );
  assert.ok(
    (
      await manageRecipient(db, owner.id, a.id, {
        operation: "merge",
        targetId: b.id,
      })
    ).success,
  );
  assert.equal(
    (await db.wishlist.findUnique({ where: { id: list.id } })).recipientId,
    b.id,
  );
  assert.ok(
    (await manageRecipient(db, owner.id, b.id, { operation: "delete" }))
      .success,
  );
  assert.equal(
    (await db.wishlist.findUnique({ where: { id: list.id } })).recipientId,
    null,
  );
});
test("import validates the entire document and creates private copies without sharing or reservations", async () => {
  const raw = {
    version: 1,
    lists: [
      {
        name: "Imported",
        visibility: "PUBLIC",
        shareToken: "secret",
        recipient: { name: "Kid" },
        gifts: [
          {
            title: "Book",
            url: "https://shop.example/book",
            alternativeUrls: "https://other.example/book",
            priceCents: 1200,
            currency: "EUR",
            priority: "HIGH",
            reservations: [{ userId: stranger.id }],
          },
        ],
      },
    ],
  };
  const parsed = parsePersonalExport(raw);
  assert.equal(parsed.lists.length, 1);
  await importPersonalExport(db, owner.id, parsed);
  const list = await db.wishlist.findFirst({
    where: { name: "Imported" },
    include: { items: { include: { reservations: true } }, recipient: true },
  });
  assert.equal(list.visibility, "PRIVATE");
  assert.equal(list.shareToken, null);
  assert.equal(list.recipient.name, "Kid");
  assert.equal(list.items[0].reservations.length, 0);
  assert.throws(() =>
    parsePersonalExport({
      ...raw,
      lists: [
        { name: "Bad", gifts: [{ title: "Bad", url: "javascript:alert(1)" }] },
      ],
    }),
  );
  assert.throws(() => parsePersonalExport({ version: 2, lists: [] }));
});
test("merchant link checks distinguish missing links from temporary or unknown failures", async () => {
  assert.equal(
    await checkMerchantLink("https://shop.example/old", async () => {
      throw Object.assign(new Error("HTTP status 404"), { status: 404 });
    }),
    "missing",
  );
  assert.equal(
    await checkMerchantLink("https://shop.example/block", async () => {
      throw Object.assign(new Error("HTTP status 403"), { status: 403 });
    }),
    "unknown",
  );
  assert.equal(
    await checkMerchantLink("https://shop.example/ok", async () => ({
      bytes: Buffer.from("<html>Product</html>"),
      url: "https://shop.example/ok",
    })),
    "available",
  );
});
test("a failed photo import leaves no lists or uploaded files behind", async () => {
  const previous = process.env.UPLOAD_DIR;
  process.env.UPLOAD_DIR = path.join(directory, "photos");
  try {
    const sharp = require("sharp");
    const bytes = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#556688" },
    })
      .webp()
      .toBuffer();
    const document = parsePersonalExport({
      version: 1,
      lists: [
        {
          name: "Rollback import",
          gifts: [
            {
              title: "Valid photo",
              photo: {
                mimeType: "image/webp",
                base64: bytes.toString("base64"),
              },
            },
            {
              title: "Invalid photo",
              photo: {
                mimeType: "image/webp",
                base64: Buffer.from("invalid image bytes").toString("base64"),
              },
            },
          ],
        },
      ],
    });
    await assert.rejects(importPersonalExport(db, owner.id, document));
    assert.equal(
      await db.wishlist.count({ where: { name: "Rollback import" } }),
      0,
    );
    assert.deepEqual(fs.readdirSync(process.env.UPLOAD_DIR), []);
    const tooManyRecipients = parsePersonalExport({
      version: 1,
      lists: Array.from({ length: 50 }, (_, i) => ({
        name: `Rollback capacity ${i}`,
        recipient: { name: `Capacity child ${i}` },
        gifts:
          i === 0
            ? [
                {
                  title: "Valid photo",
                  photo: {
                    mimeType: "image/webp",
                    base64: bytes.toString("base64"),
                  },
                },
              ]
            : [],
      })),
    });
    await assert.rejects(importPersonalExport(db, owner.id, tooManyRecipients));
    assert.equal(
      await db.wishlist.count({
        where: { name: { startsWith: "Rollback capacity" } },
      }),
      0,
    );
    assert.equal(
      await db.recipient.count({
        where: { name: { startsWith: "Capacity child" } },
      }),
      0,
    );
    assert.deepEqual(fs.readdirSync(process.env.UPLOAD_DIR), []);
  } finally {
    if (previous === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = previous;
  }
});
test("reminders use accessible upcoming events and only the giver's reservations", async () => {
  const family = await db.family.create({
    data: {
      name: "Family",
      ownerId: owner.id,
      members: { create: [{ userId: owner.id, role: "ADMIN" }] },
    },
  });
  await db.event.create({
    data: {
      name: "Soon",
      date: new Date("2026-10-12T12:00:00Z"),
      familyId: family.id,
    },
  });
  await db.event.create({
    data: {
      name: "Old",
      date: new Date("2026-09-12T12:00:00Z"),
      familyId: family.id,
    },
  });
  const list = await db.wishlist.create({
    data: {
      name: "Other list",
      ownerId: stranger.id,
      visibility: "PUBLIC",
      neededBy: "2026-10-13",
    },
  });
  const gift = await db.wishlistItem.create({
    data: { title: "Reserved", wishlistId: list.id },
  });
  await db.reservation.create({ data: { itemId: gift.id, userId: owner.id } });
  const reminders = await readReminders(
    db,
    owner.id,
    new Date("2026-10-07T12:00:00Z"),
  );
  assert.deepEqual(
    reminders.events.map((e) => e.name),
    ["Soon"],
  );
  assert.equal(reminders.gifts.length, 1);
  const other = await readReminders(
    db,
    stranger.id,
    new Date("2026-10-07T12:00:00Z"),
  );
  assert.equal(other.gifts.length, 0);
  assert.equal(other.events.length, 0);
});
