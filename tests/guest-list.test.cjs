require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  guestOwner,
  newGuestSession,
} = require("../src/lib/guest-list-service.ts");

test("guest management uses a random secret, stored only as a hash", () => {
  const a = newGuestSession();
  const b = newGuestSession();
  assert.match(a.token, /^[a-f0-9]{64}$/);
  assert.notEqual(a.token, b.token);
  assert.notEqual(a.token, a.hash);
  assert.ok(a.expires > new Date());
});

test("guest ownership rejects missing, malformed, expired and account tokens", async () => {
  const session = newGuestSession();
  const now = new Date();
  const calls = [];
  const db = {
    user: {
      findFirst: async ({ where }) => {
        calls.push(where);
        return where.guestTokenHash === session.hash &&
          where.guestExpiresAt.gt < session.expires &&
          where.email === null &&
          where.password === null
          ? { id: "guest" }
          : null;
      },
    },
  };
  assert.equal(await guestOwner(db, undefined, now), null);
  assert.equal(await guestOwner(db, "malformed", now), null);
  assert.equal(calls.length, 0);
  assert.equal(await guestOwner(db, "a".repeat(64), now), null);
  assert.deepEqual(await guestOwner(db, session.token, now), { id: "guest" });
  assert.equal(
    await guestOwner(
      db,
      session.token,
      new Date(session.expires.getTime() + 1),
    ),
    null,
  );
});
