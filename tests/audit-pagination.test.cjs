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
const { readWishlist } = require("../src/lib/wishlist-service.ts");
const { giftPageOptions } = require("../src/lib/gift-search.ts");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cadeoly-pagination-"));
const file = path.join(directory, "test.db");
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
let owner, giver, list;
before(async () => {
  owner = await db.user.create({
    data: { name: "Owner", email: "pagination-owner@example.test" },
  });
  giver = await db.user.create({
    data: { name: "Giver", email: "pagination-giver@example.test" },
  });
  list = await db.wishlist.create({
    data: {
      name: "Paged gifts",
      ownerId: owner.id,
      visibility: "LINK",
      shareToken: "current-link",
    },
  });
  for (let i = 0; i < 49; i++) {
    const item = await db.wishlistItem.create({
      data: {
        wishlistId: list.id,
        title: [0, 25].includes(i) ? `Écharpe ${i}` : `Gift ${i}`,
        description: `Description ${i}`,
        url: `https://shop.example/${i}`,
        priceCents: i === 48 ? null : 1000,
        currency: "EUR",
        priority: [0, 25].includes(i) ? "ESSENTIAL" : "NORMAL",
        createdAt: new Date(Date.UTC(2026, 9, 1, 0, 0, i)),
      },
    });
    if (i === 0)
      await db.reservation.create({
        data: { itemId: item.id, userId: giver.id },
      });
  }
});
after(async () => {
  await db.$disconnect();
  fs.rmSync(directory, { recursive: true, force: true });
});

test("server pages return at most 24 full gifts while totals cover the filtered list", async () => {
  const pages = await Promise.all(
    [1, 2, 3].map((page) =>
      readWishlist(db, list.id, owner.id, undefined, { page, locale: "fr" }),
    ),
  );
  assert.deepEqual(
    pages.map((row) => row.items.length),
    [24, 24, 1],
  );
  assert.equal(
    new Set(pages.flatMap((row) => row.items.map((gift) => gift.id))).size,
    49,
  );
  assert.deepEqual(pages[0].pagination.totals, { EUR: 48000 });
  assert.equal(pages[0].pagination.unpriced, 1);
  assert.equal(pages[0].pagination.total, 49);
  assert.equal(pages[0].pagination.pages, 3);
  assert.equal(
    (await readWishlist(db, list.id, owner.id, undefined, { page: 999 }))
      .pagination.page,
    3,
  );
});

test("paged filters retain accent search and global matching across page boundaries", async () => {
  const result = await readWishlist(db, list.id, owner.id, undefined, {
    page: 2,
    locale: "fr",
    filters: { query: "echarpe" },
  });
  assert.equal(result.items.length, 2);
  assert.equal(result.pagination.page, 1);
  assert.equal(result.pagination.matched, 2);
  assert.deepEqual(result.pagination.totals, { EUR: 2000 });
  const empty = await readWishlist(db, list.id, owner.id, undefined, {
    filters: { query: "no match" },
  });
  assert.equal(empty.items.length, 0);
  assert.equal(empty.pagination.total, 49);
  assert.equal(empty.pagination.matched, 0);
});

test("full gift retrieval is restricted in the database, and metadata never escapes into page props", async () => {
  let detailReads = 0;
  const observed = {
    wishlistItem: db.wishlistItem,
    wishlist: {
      findUnique: async (query) => {
        if (query.select?.items) {
          detailReads++;
          assert.equal(query.select.items.take, 24);
          assert.equal(query.select.items.skip, 0);
          assert.equal(query.select.items.where.id, undefined);
        }
        return db.wishlist.findUnique(query);
      },
    },
  };
  const result = await readWishlist(observed, list.id, owner.id, undefined, {
    page: 1,
  });
  assert.equal(detailReads, 1);
  assert.equal(result.items.length, 24);
  assert.ok(!JSON.stringify(result.pagination).includes("Description"));
  assert.ok(!JSON.stringify(result.pagination).includes("current-link"));
});

test("simple priority and price filters page in SQLite without reading all gift metadata", async () => {
  const observed = new Proxy(db, {
    get(target, key) {
      if (key !== "wishlistItem") return target[key];
      return new Proxy(target.wishlistItem, {
        get(model, operation) {
          if (operation !== "findMany") return model[operation];
          return (query) => {
            assert.equal(
              query.select?.title,
              undefined,
              "no full-list metadata read",
            );
            return model.findMany(query);
          };
        },
      });
    },
  });
  const result = await readWishlist(observed, list.id, owner.id, undefined, {
    page: 999,
    filters: { priority: "ESSENTIAL", maxPrice: "10" },
  });
  assert.equal(result.pagination.total, 49);
  assert.equal(result.pagination.matched, 2);
  assert.equal(result.pagination.page, 1);
  assert.deepEqual(result.pagination.totals, { EUR: 2000 });
  assert.equal(result.items.length, 2);
});

test("paged owner views conceal reservation signals, guests can filter theirs, revoked links stay inaccessible", async () => {
  const own = await readWishlist(db, list.id, owner.id, undefined, {
    filters: { status: "mine" },
  });
  assert.equal(own.pagination.matched, 49);
  assert.ok(
    own.items.every(
      (item) =>
        !item.isReserved &&
        !item.reservedByMe &&
        !item.reservations &&
        !item.contributions,
    ),
  );
  const theirs = await readWishlist(db, list.id, giver.id, "current-link", {
    filters: { status: "mine" },
  });
  assert.equal(theirs.items.length, 1);
  assert.equal(theirs.items[0].reservedByMe, true);
  assert.equal(
    await readWishlist(db, list.id, giver.id, "wrong-link", { page: 1 }),
    null,
  );
});

test("SQL price filtering preserves zero prices, unpriced totals and mixed currencies", async () => {
  const extra = await db.wishlist.create({
    data: { name: "Currencies", ownerId: owner.id },
  });
  for (const [title, priceCents] of [
    ["Unknown", null],
    ["Free", 0],
    ["Priced", 1500],
  ]) {
    await db.wishlistItem.create({
      data: { wishlistId: extra.id, title, priceCents },
    });
  }
  for (const maxPrice of ["invalid", "-1"]) {
    const result = await readWishlist(db, extra.id, owner.id, undefined, {
      filters: { maxPrice },
    });
    assert.equal(result.pagination.total, 3);
    assert.equal(result.pagination.matched, 0);
  }
  const free = await readWishlist(db, extra.id, owner.id, undefined, {
    filters: { maxPrice: "0" },
  });
  assert.deepEqual(
    free.items.map((item) => item.title),
    ["Free"],
  );
  assert.deepEqual(free.pagination.totals, { EUR: 0 });
  const all = await readWishlist(db, extra.id, owner.id, undefined, {});
  assert.equal(all.pagination.unpriced, 1);
  await db.wishlistItem.create({
    data: {
      wishlistId: extra.id,
      title: "Dollars",
      priceCents: 4000,
      currency: "USD",
    },
  });
  const mixed = await readWishlist(db, extra.id, owner.id, undefined, {
    filters: { maxPrice: "1" },
  });
  assert.equal(mixed.pagination.matched, 4);
  assert.equal(mixed.pagination.mixedCurrencies, true);
  assert.equal(mixed.pagination.filters.maxPrice, "");
  assert.deepEqual(mixed.pagination.totals, { EUR: 1500, USD: 4000 });
});

test("SQL totals retain sums above the 32-bit item price limit", async () => {
  const extra = await db.wishlist.create({
    data: { name: "Large totals", ownerId: owner.id },
  });
  for (let i = 0; i < 3; i++) {
    await db.wishlistItem.create({
      data: {
        wishlistId: extra.id,
        title: `Large gift ${i}`,
        priceCents: 999999999,
      },
    });
  }
  for (const filters of [{}, { query: "Large" }]) {
    const result = await readWishlist(db, extra.id, owner.id, undefined, {
      filters,
    });
    assert.deepEqual(result.pagination.totals, { EUR: 2999999997 });
  }
});

test("page options accept only bounded supported filters and sane page values", () => {
  assert.deepEqual(
    giftPageOptions(
      { q: "echarpe", page: "2", sort: "name", from: "archived" },
      "fr",
    ),
    {
      page: 2,
      locale: "fr",
      filters: {
        query: "echarpe",
        maxPrice: "",
        priority: "all",
        status: "all",
        sort: "name",
      },
    },
  );
  const invalid = giftPageOptions(
    {
      page: "NaN",
      q: "x".repeat(150),
      sort: "bad",
      status: "bad",
      priority: "bad",
    },
    "en",
  );
  assert.equal(invalid.page, 1);
  assert.equal(invalid.filters.query.length, 120);
  assert.equal(invalid.filters.sort, "manual");
  assert.equal(invalid.filters.status, "all");
  assert.equal(invalid.filters.priority, "all");
});
