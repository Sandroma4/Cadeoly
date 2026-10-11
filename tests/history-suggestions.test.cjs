require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  matchesSuggestionPrice,
  partitionGiftHistory,
} = require("../src/lib/gift-suggestions.ts");

test("suggestion ranges have exclusive upper bounds and inclusive lower bounds", () => {
  const matches = (priceCents, range) =>
    matchesSuggestionPrice({ priceCents, currency: "EUR" }, range, "EUR");
  assert.equal(matches(2499, "under25"), true);
  assert.equal(matches(2500, "under25"), false);
  assert.equal(matches(2500, "25to50"), true);
  assert.equal(matches(5000, "25to50"), false);
  assert.equal(matches(5000, "50to100"), true);
  assert.equal(matches(10000, "50to100"), false);
  assert.equal(matches(10000, "100plus"), true);
  assert.equal(matches(null, "under25"), false);
  assert.equal(matches(-100, "under25"), false);
});

test("suggestions compare only the selected currency and retain unpriced gifts without a range", () => {
  assert.equal(
    matchesSuggestionPrice(
      { priceCents: 2000, currency: "USD" },
      "under25",
      "EUR",
    ),
    false,
  );
  assert.equal(
    matchesSuggestionPrice(
      { priceCents: 2000, currency: "USD" },
      "under25",
      "USD",
    ),
    true,
  );
  assert.equal(
    matchesSuggestionPrice(
      { priceCents: 2000, currency: null },
      "under25",
      "EUR",
    ),
    true,
  );
  assert.equal(
    matchesSuggestionPrice({ priceCents: null, currency: "USD" }, "", "EUR"),
    true,
  );
});

test("only GIVEN reservations move to history, preserving unavailable guarded rows", () => {
  const active = ["RESERVED", "BOUGHT", "WRAPPED"].map((preparationStatus) => ({
    preparationStatus,
  }));
  const unavailable = { itemId: "private", gift: null };
  const given = { preparationStatus: "GIVEN", itemId: "completed" };
  const rows = [...active, unavailable, given];
  const result = partitionGiftHistory(rows);
  assert.deepEqual(result.active, [...active, unavailable]);
  assert.deepEqual(result.history, [given]);
  assert.equal(rows.length, 5);
});
