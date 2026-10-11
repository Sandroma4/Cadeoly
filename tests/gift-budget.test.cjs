require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  summarizeGiftBudget,
  parseGiftBudget,
} = require("../src/lib/gift-budget.ts");
test("budget separates currencies and occasions and multiplies reserved quantities", () => {
  const reservations = [
    {
      gift: {
        priceCents: 1200,
        currency: "EUR",
        quantity: 3,
        occasion: "Birthday",
      },
    },
    {
      gift: {
        priceCents: 500,
        currency: "USD",
        quantity: 1,
        occasion: "Birthday",
      },
    },
    {
      gift: {
        priceCents: 900,
        currency: "EUR",
        quantity: 1,
        occasion: "Christmas",
      },
    },
    {
      gift: {
        priceCents: null,
        currency: "EUR",
        quantity: 1,
        occasion: "Birthday",
      },
    },
    { gift: null },
  ];
  const contributions = [
    {
      amountCents: 700,
      currency: "EUR",
      occasion: "Birthday",
      href: "/lists/yes",
    },
    { amountCents: 9999, currency: null, occasion: null, href: null },
  ];
  assert.deepEqual(
    summarizeGiftBudget(reservations, contributions, "occasion:Birthday"),
    {
      totals: [
        {
          currency: "EUR",
          reservedCents: 3600,
          contributedCents: 700,
          totalCents: 4300,
        },
        {
          currency: "USD",
          reservedCents: 500,
          contributedCents: 0,
          totalCents: 500,
        },
      ],
      unpriced: 1,
      unavailable: 2,
    },
  );
  assert.equal(
    summarizeGiftBudget(reservations, contributions, "ALL").totals[0]
      .totalCents,
    5200,
  );
});
test("budget amounts use cents and reject malformed or unsupported currency values", () => {
  assert.deepEqual(parseGiftBudget("occasion:Birthday", "EUR", "12.34"), {
    scope: "occasion:Birthday",
    currency: "EUR",
    amountCents: 1234,
  });
  for (const [scope, currency, amount] of [
    ["bad", "EUR", "1"],
    ["ALL", "BAD", "1"],
    ["ALL", "EUR", "-1"],
    ["ALL", "EUR", "NaN"],
    ["ALL", "EUR", "1.234"],
  ]) {
    assert.equal(parseGiftBudget(scope, currency, amount), null);
  }
  assert.equal(parseGiftBudget("ALL", "EUR", "0").amountCents, 0);
});

const { before, after } = require("node:test");
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
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wishi-gift-budget-"));
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
let owner, buyer, list;
before(async () => {
  owner = await db.user.create({ data: { name: "Recipient" } });
  buyer = await db.user.create({ data: { name: "Buyer" } });
  list = await db.wishlist.create({
    data: {
      name: "Birthday",
      ownerId: owner.id,
      occasion: "Birthday",
      visibility: "LINK",
      shareToken: "budget-link",
    },
  });
  const gift = await db.wishlistItem.create({
    data: {
      title: "Book",
      wishlistId: list.id,
      priceCents: 1300,
      currency: "EUR",
      quantityDesired: 2,
    },
  });
  await db.reservation.create({
    data: {
      userId: buyer.id,
      itemId: gift.id,
      quantity: 2,
      accessTokenHash: hashShareToken("budget-link"),
    },
  });
  const groupGift = await db.wishlistItem.create({
    data: {
      title: "Trip",
      wishlistId: list.id,
      priceCents: 10000,
      currency: "EUR",
      isGroupGift: true,
    },
  });
  await db.contribution.create({
    data: {
      userId: buyer.id,
      itemId: groupGift.id,
      amountCents: 2000,
      accessTokenHash: hashShareToken("budget-link"),
    },
  });
});
after(async () => {
  await db.$disconnect();
  fs.rmSync(directory, { recursive: true, force: true });
});
test("actual reservation and contribution DTOs include totals only while access is valid", async () => {
  let reservations = await readMyReservations(db, buyer.id);
  let contributions = await readMyContributions(db, buyer.id);
  assert.equal(
    summarizeGiftBudget(reservations, contributions, "occasion:Birthday")
      .totals[0].totalCents,
    4600,
  );
  await db.wishlist.update({
    where: { id: list.id },
    data: { shareToken: "rotated-link" },
  });
  reservations = await readMyReservations(db, buyer.id);
  contributions = await readMyContributions(db, buyer.id);
  assert.equal(reservations[0].gift, null);
  assert.equal(contributions[0].currency, null);
  assert.equal(contributions[0].occasion, null);
  assert.deepEqual(summarizeGiftBudget(reservations, contributions, "ALL"), {
    totals: [],
    unpriced: 0,
    unavailable: 2,
  });
});
test("persisted budgets stay separate by user occasion and currency", async () => {
  await db.giftBudget.createMany({
    data: [
      { userId: buyer.id, scope: "ALL", currency: "EUR", amountCents: 10000 },
      {
        userId: buyer.id,
        scope: "occasion:Birthday",
        currency: "EUR",
        amountCents: 5000,
      },
      { userId: buyer.id, scope: "ALL", currency: "USD", amountCents: 3000 },
      { userId: owner.id, scope: "ALL", currency: "EUR", amountCents: 99999 },
    ],
  });
  const rows = await db.giftBudget.findMany({ where: { userId: buyer.id } });
  assert.equal(rows.length, 3);
  assert.equal(
    rows.some((row) => row.amountCents === 99999),
    false,
  );
  await db.giftBudget.upsert({
    where: {
      userId_scope_currency: {
        userId: buyer.id,
        scope: "ALL",
        currency: "EUR",
      },
    },
    update: { amountCents: 20000 },
    create: {
      userId: buyer.id,
      scope: "ALL",
      currency: "EUR",
      amountCents: 20000,
    },
  });
  assert.equal(await db.giftBudget.count({ where: { userId: buyer.id } }), 3);
});
