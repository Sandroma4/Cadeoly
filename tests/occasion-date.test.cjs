require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { nextOccasionDate } = require("../src/lib/occasion-date.ts");
const day = (value) => new Date(value + "T12:00:00");

test("fixed festivals include today and roll over after the festival", () => {
  for (const [kind, date] of [
    ["Christmas", "12-25"],
    ["SaintNicholas", "12-06"],
  ]) {
    assert.equal(nextOccasionDate(kind, day("2026-01-01")), `2026-${date}`);
    assert.equal(nextOccasionDate(kind, day(`2026-${date}`)), `2026-${date}`);
    assert.equal(nextOccasionDate(kind, day("2026-12-31")), `2027-${date}`);
  }
});
test("Gregorian Easter follows its actual date each year", () => {
  for (const [year, date] of [
    [2024, "03-31"],
    [2025, "04-20"],
    [2026, "04-05"],
    [2027, "03-28"],
    [2028, "04-16"],
    [2038, "04-25"],
  ]) {
    assert.equal(
      nextOccasionDate("Easter", day(`${year}-01-01`)),
      `${year}-${date}`,
    );
    assert.equal(
      nextOccasionDate("Easter", day(`${year}-${date}`)),
      `${year}-${date}`,
    );
  }
  assert.equal(nextOccasionDate("Easter", day("2026-04-06")), "2027-03-28");
});
test("personal occasions have no assumed date", () => {
  for (const kind of ["Birthday", "Birth", "Wedding", ""]) {
    assert.equal(nextOccasionDate(kind, day("2026-10-11")), "");
  }
});
