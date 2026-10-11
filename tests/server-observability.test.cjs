const { test } = require("node:test");
const assert = require("node:assert/strict");
require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});

test("business counters contain only event name, timestamp and count", () => {
  const { reportBusinessEvent } = require("../src/lib/observability.ts");
  const messages = [];
  const info = console.info;
  console.info = (value) => messages.push(JSON.parse(value));
  try {
    for (const event of ["signup", "wishlist_created", "gift_reserved"])
      reportBusinessEvent(event);
    assert.equal(messages.length, 3);
    assert.deepEqual(
      messages.map(({ event, count }) => [event, count]),
      [
        ["signup", 1],
        ["wishlist_created", 1],
        ["gift_reserved", 1],
      ],
    );
    assert.ok(
      messages.every(
        (value) => Object.keys(value).sort().join(",") === "at,count,event",
      ),
    );
  } finally {
    console.info = info;
  }
});
test("server errors and slow operations produce useful logs without identifiers, tokens or exception messages", async () => {
  const {
    reportServerError,
    reportSlowOperation,
  } = require("../src/lib/observability.ts");
  const warnings = [],
    errors = [];
  const warn = console.warn,
    error = console.error;
  console.warn = (value) => warnings.push(JSON.parse(value));
  console.error = (value) => errors.push(JSON.parse(value));
  try {
    reportSlowOperation("database", 12);
    reportSlowOperation("database", 302.9);
    reportServerError(
      new Error("password=private@example.test"),
      "/fr/share/secret-token?email=private@example.test",
    );
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].durationMs, 303);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].route, "/fr/share/:id");
    assert.equal(
      JSON.stringify([...warnings, ...errors]).includes("secret-token"),
      false,
    );
    assert.equal(
      JSON.stringify(errors).includes("private@example.test"),
      false,
    );
    assert.equal(errors[0].event, "server_error");
  } finally {
    console.warn = warn;
    console.error = error;
  }
});
