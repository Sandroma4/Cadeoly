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
const bcrypt = require("bcryptjs");
const sharp = require("sharp");
const {
  requestReset,
  resetPassword,
  validResetToken,
  sessionIsCurrent,
  resetTokenHash,
} = require("../src/lib/password-reset-service.ts");
const {
  readMyReservations,
  reserveGift,
  cancelGift,
  readWishlist,
} = require("../src/lib/wishlist-service.ts");
const {
  saveGiftPhoto,
  readGiftPhoto,
  removeGiftPhoto,
} = require("../src/lib/gift-photos.ts");
const {
  mailConfiguration,
  sendResetMail,
} = require("../src/lib/reset-mail.ts");
const { itemSchema, emailSchema } = require("../src/lib/validation.ts");
const { selectGifts, giftTotals } = require("../src/lib/gift-search.ts");
const {
  readEvent,
  editEvent,
  removeEvent,
} = require("../src/lib/event-service.ts");
const {
  pendingInvitations,
  issueInvitation,
  revokeInvitation,
  joinFamily,
} = require("../src/lib/invitation-service.ts");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wishi-priorities-"));
const database = path.join(directory, "test.db");
const sql = new DatabaseSync(database);
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
  datasources: { db: { url: "file:" + database.replaceAll("\\", "/") } },
});
let owner, giver, stranger, list, gift;
before(async () => {
  [owner, giver, stranger] = await Promise.all(
    ["owner", "giver", "stranger"].map((name) =>
      db.user.create({
        data: { name, email: `${name}@example.test`, password: "old-hash" },
      }),
    ),
  );
  list = await db.wishlist.create({
    data: {
      name: "Surprise",
      ownerId: owner.id,
      visibility: "LINK",
      shareToken: "a".repeat(64),
    },
  });
  gift = await db.wishlistItem.create({
    data: {
      title: "Sneakers",
      wishlistId: list.id,
      size: "42",
      color: "Blue",
      model: "Classic",
    },
  });
});
after(async () => {
  await db.$disconnect();
  // This directory is created exclusively by this test, outside user data.
  fs.rmSync(directory, { recursive: true, force: true });
});
test("gift search handles accents, budget, status and ordering without exposing owner reservations", () => {
  const base = {
    description: null,
    size: null,
    color: null,
    model: null,
    currency: "EUR",
    priority: "NORMAL",
    isReserved: false,
    reservedByMe: false,
  };
  const gifts = [
    { ...base, id: "a", title: "Écharpe bleue", priceCents: 2000 },
    {
      ...base,
      id: "b",
      title: "Livre",
      priceCents: 0,
      priority: "HIGH",
      isReserved: true,
      reservedByMe: true,
    },
    { ...base, id: "c", title: "Chaussures", priceCents: null },
  ];
  const filter = {
    query: "",
    maxPrice: "",
    priority: "all",
    status: "all",
    sort: "recent",
  };
  assert.deepEqual(
    selectGifts(gifts, { ...filter, query: "echarpe" }, false, "fr").map(
      (g) => g.id,
    ),
    ["a"],
  );
  assert.deepEqual(
    selectGifts(gifts, { ...filter, maxPrice: "0" }, false, "fr").map(
      (g) => g.id,
    ),
    ["b"],
  );
  assert.deepEqual(
    selectGifts(gifts, { ...filter, status: "available" }, false, "fr").map(
      (g) => g.id,
    ),
    ["a", "c"],
  );
  assert.deepEqual(
    selectGifts(gifts, { ...filter, status: "mine" }, false, "fr").map(
      (g) => g.id,
    ),
    ["b"],
  );
  assert.equal(
    selectGifts(gifts, { ...filter, status: "mine" }, true, "fr").length,
    3,
  );
  assert.deepEqual(
    selectGifts(gifts, { ...filter, sort: "priceDesc" }, false, "fr").map(
      (g) => g.id,
    ),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    selectGifts(gifts, { ...filter, sort: "priority" }, false, "fr").map(
      (g) => g.id,
    ),
    ["b", "a", "c"],
  );
  assert.equal(
    selectGifts(gifts, { ...filter, maxPrice: "-1" }, false, "fr").length,
    0,
  );
  assert.deepEqual(
    giftTotals([
      ...gifts,
      { ...base, id: "d", title: "USD gift", priceCents: 500, currency: "USD" },
    ]),
    { totals: { EUR: 2000, USD: 500 }, unpriced: 1 },
  );
});
test("event pages enforce family access and show only accessible wishlists", async () => {
  const family = await db.family.create({
    data: {
      name: "Event family",
      ownerId: owner.id,
      members: {
        create: [{ userId: owner.id, role: "ADMIN" }, { userId: giver.id }],
      },
    },
  });
  const event = await db.event.create({
    data: {
      name: "Event",
      date: new Date("2026-12-25T12:00:00Z"),
      familyId: family.id,
    },
  });
  await db.wishlist.createMany({
    data: [
      {
        name: "Visible",
        ownerId: owner.id,
        eventId: event.id,
        visibility: "FAMILY",
      },
      {
        name: "Secret",
        ownerId: owner.id,
        eventId: event.id,
        visibility: "PRIVATE",
      },
      {
        name: "Link",
        ownerId: owner.id,
        eventId: event.id,
        visibility: "LINK",
      },
    ],
  });
  assert.equal(await readEvent(db, event.id, stranger.id), null);
  const member = await readEvent(db, event.id, giver.id);
  assert.equal(member.canManage, false);
  assert.deepEqual(
    member.wishlists.map((l) => l.name),
    ["Visible"],
  );
  assert.equal((await readEvent(db, event.id, owner.id)).wishlists.length, 3);
  assert.equal((await readEvent(db, event.id, owner.id)).canManage, true);
  assert.deepEqual(
    await editEvent(db, event.id, giver.id, {
      name: "Hacked",
      description: "",
      date: "2026-12-24",
    }),
    { error: "forbidden" },
  );
  assert.deepEqual(
    await editEvent(db, event.id, owner.id, {
      name: "Christmas",
      description: "Updated",
      date: "2026-12-24",
    }),
    { success: true },
  );
  assert.equal(
    (await readEvent(db, event.id, giver.id)).date.toISOString(),
    "2026-12-24T12:00:00.000Z",
  );
  assert.deepEqual(await removeEvent(db, event.id, stranger.id), {
    error: "forbidden",
  });
  assert.deepEqual(await removeEvent(db, event.id, owner.id), {
    success: true,
  });
  const preserved = await db.wishlist.findMany({
    where: { name: { in: ["Visible", "Secret", "Link"] } },
  });
  assert.equal(preserved.length, 3);
  assert.ok(preserved.every((l) => l.eventId === null));
});
test("pending invitations are admin-only, renewable and revocable", async () => {
  const family = await db.family.create({
    data: {
      name: "Invitation family",
      ownerId: owner.id,
      members: {
        create: [{ userId: owner.id, role: "ADMIN" }, { userId: giver.id }],
      },
    },
  });
  assert.deepEqual(
    await issueInvitation(db, family.id, stranger.email, giver.id),
    { error: "forbidden" },
  );
  assert.deepEqual(
    await issueInvitation(db, family.id, giver.email, owner.id),
    { error: "alreadyMember" },
  );
  const first = await issueInvitation(db, family.id, stranger.email, owner.id);
  assert.match(first.token, /^[a-f0-9]{64}$/);
  const second = await issueInvitation(db, family.id, stranger.email, owner.id);
  assert.equal(
    await db.invitation.findUnique({ where: { token: first.token } }),
    null,
  );
  assert.deepEqual(await pendingInvitations(db, family.id, giver.id), []);
  assert.deepEqual(await pendingInvitations(db, family.id, stranger.id), []);
  const pending = await pendingInvitations(db, family.id, owner.id);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].token, second.token);
  assert.deepEqual(await revokeInvitation(db, pending[0].id, giver.id), {
    error: "forbidden",
  });
  assert.deepEqual(await revokeInvitation(db, pending[0].id, owner.id), {
    success: true,
  });
  assert.deepEqual(await joinFamily(db, second.token, stranger), {
    error: "invalidInvitation",
  });
  assert.equal((await pendingInvitations(db, family.id, owner.id)).length, 0);
});
test("reserved gifts are scoped to the giver and disappear behind revoked access", async () => {
  await reserveGift(db, gift.id, giver.id, list.shareToken);
  const mine = await readMyReservations(db, giver.id);
  assert.equal(mine[0].gift.title, "Sneakers");
  assert.equal(mine[0].gift.size, "42");
  assert.equal((await readMyReservations(db, owner.id)).length, 0);
  assert.equal((await readMyReservations(db, stranger.id)).length, 0);
  const ownerView = await readWishlist(db, list.id, owner.id);
  assert.equal(ownerView.items[0].isReserved, false);
  assert.ok(!JSON.stringify(ownerView).includes(giver.id));
  await db.wishlist.update({
    where: { id: list.id },
    data: { shareToken: "b".repeat(64) },
  });
  assert.deepEqual(await readMyReservations(db, giver.id), [
    { itemId: gift.id, gift: null },
  ]);
  await db.wishlist.update({
    where: { id: list.id },
    data: { visibility: "PRIVATE", shareToken: null },
  });
  assert.equal((await readMyReservations(db, giver.id))[0].gift, null);
  assert.deepEqual(await cancelGift(db, gift.id, giver.id), { success: true });
});
test("recovery tokens are hashed, rotated, consumed once and revoke old sessions", async () => {
  let first, second;
  await requestReset(
    db,
    giver.email,
    async (token) => {
      first = token;
    },
    "test-secret",
  );
  const stored = await db.passwordResetToken.findUnique({
    where: { userId: giver.id },
  });
  assert.equal(stored.tokenHash, resetTokenHash(first));
  assert.notEqual(stored.tokenHash, first);
  assert.equal(await sessionIsCurrent(db, giver.id, 0), true);
  await requestReset(
    db,
    giver.email,
    async (token) => {
      second = token;
    },
    "test-secret",
  );
  assert.equal(await validResetToken(db, first), false);
  assert.equal(await validResetToken(db, second), true);
  assert.deepEqual(await resetPassword(db, second, "New-Wishi-2026!"), {
    success: true,
  });
  assert.deepEqual(await resetPassword(db, second, "Another-Wishi-2026!"), {
    error: "invalidResetLink",
  });
  const current = await db.user.findUnique({ where: { id: giver.id } });
  assert.ok(await bcrypt.compare("New-Wishi-2026!", current.password));
  assert.equal(await sessionIsCurrent(db, giver.id, 0), false);
  assert.equal(await sessionIsCurrent(db, giver.id, 1), true);
});
test("expired or malformed recovery links cannot change a password", async () => {
  let token;
  await requestReset(
    db,
    owner.email,
    async (value) => {
      token = value;
    },
    "test-secret",
    new Date(Date.now() - 31 * 60 * 1000),
  );
  assert.equal(await validResetToken(db, token), false);
  assert.deepEqual(await resetPassword(db, token, "Valid-password-2026!"), {
    error: "invalidResetLink",
  });
  assert.equal(await validResetToken(db, "not-a-token"), false);
  assert.deepEqual(await resetPassword(db, "0".repeat(64), "short"), {
    error: "invalidFields",
  });
  assert.equal(
    (await db.user.findUnique({ where: { id: owner.id } })).password,
    "old-hash",
  );
});
test("concurrent recovery submissions consume the token exactly once", async () => {
  const user = await db.user.create({
    data: { email: "concurrent@example.test" },
  });
  let token;
  await requestReset(
    db,
    user.email,
    async (value) => {
      token = value;
    },
    "test-secret",
  );
  const results = await Promise.all([
    resetPassword(db, token, "Concurrent-one-2026!"),
    resetPassword(db, token, "Concurrent-two-2026!"),
  ]);
  assert.equal(results.filter((result) => result.success).length, 1);
  assert.equal(
    results.filter((result) => result.error === "invalidResetLink").length,
    1,
  );
  assert.equal(
    (await db.user.findUnique({ where: { id: user.id } })).sessionVersion,
    1,
  );
});
test("failed password update rolls back token consumption", async () => {
  const user = await db.user.create({
    data: { email: "rollback@example.test", password: "unchanged" },
  });
  let token;
  await requestReset(
    db,
    user.email,
    async (value) => {
      token = value;
    },
    "test-secret",
  );
  const connection = new DatabaseSync(database);
  connection.exec(
    `CREATE TRIGGER block_password_update BEFORE UPDATE OF password ON User WHEN OLD.id='${user.id}' BEGIN SELECT RAISE(ABORT, 'Synthetic failure'); END;`,
  );
  try {
    await assert.rejects(resetPassword(db, token, "Rollback-Wishi-2026!"));
  } finally {
    connection.exec("DROP TRIGGER block_password_update");
    connection.close();
  }
  assert.equal(await validResetToken(db, token), true);
  assert.equal(
    (await db.user.findUnique({ where: { id: user.id } })).password,
    "unchanged",
  );
});
test("unknown accounts get no token and recovery email requests are bounded", async () => {
  let sent = 0;
  const now = new Date();
  await requestReset(
    db,
    "absent@example.test",
    async () => sent++,
    "test-secret",
    now,
  );
  assert.equal(sent, 0);
  for (let i = 0; i < 5; i++)
    await requestReset(
      db,
      stranger.email,
      async () => sent++,
      "throttle-secret",
      now,
    );
  assert.equal(sent, 3);
  assert.equal(
    await db.passwordResetToken.count({ where: { userId: stranger.id } }),
    1,
  );
});
test("failed delivery invalidates its token without exposing account status", async () => {
  const previous = console.error;
  console.error = () => {};
  try {
    assert.equal(
      await requestReset(
        db,
        owner.email,
        async () => {
          throw new Error("test failure");
        },
        "failure-secret",
      ),
      undefined,
    );
  } finally {
    console.error = previous;
  }
  assert.equal(
    await db.passwordResetToken.count({ where: { userId: owner.id } }),
    0,
  );
});
test("photos are decoded and re-encoded; invalid data, oversized uploads and path traversal are rejected", async () => {
  process.env.UPLOAD_DIR = path.join(directory, "photos");
  const source = await sharp({
    create: { width: 20, height: 10, channels: 3, background: "#3366ff" },
  })
    .png()
    .toBuffer();
  const filename = await saveGiftPhoto(
    new File([source], "gift.png", { type: "image/png" }),
  );
  assert.match(filename, /^[a-f0-9-]{36}\.webp$/);
  const bytes = await readGiftPhoto(filename);
  const meta = await sharp(bytes).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 20);
  await assert.rejects(
    saveGiftPhoto(new File(["<svg/>"], "fake.png", { type: "image/png" })),
    /invalidPhoto/,
  );
  await assert.rejects(
    saveGiftPhoto(new File([Buffer.alloc(5 * 1024 * 1024 + 1)], "large.jpg")),
    /invalidPhoto/,
  );
  assert.equal(await readGiftPhoto("../test.db"), null);
  await removeGiftPhoto(filename);
  assert.equal(await readGiftPhoto(filename), null);
  delete process.env.UPLOAD_DIR;
});
test("variants are bounded and emails are normalized before validation", () => {
  assert.equal(emailSchema.parse(" GIVER@example.test "), "giver@example.test");
  const base = {
    title: "Gift",
    price: "",
    priority: "NORMAL",
    size: " 42 ",
    color: "Blue",
    model: "Classic",
  };
  assert.equal(itemSchema.parse(base).size, "42");
  assert.equal(
    itemSchema.safeParse({ ...base, color: "x".repeat(81) }).success,
    false,
  );
});
test("local mail capture sends nothing and refuses a public application URL", async () => {
  const previous = {
    AUTH_URL: process.env.AUTH_URL,
    MAIL_TRANSPORT: process.env.MAIL_TRANSPORT,
    EMAIL_OUTBOX_DIR: process.env.EMAIL_OUTBOX_DIR,
  };
  process.env.AUTH_URL = "http://localhost:3001";
  process.env.MAIL_TRANSPORT = "file";
  process.env.EMAIL_OUTBOX_DIR = path.join(directory, "mail");
  try {
    await sendResetMail("synthetic@example.test", "c".repeat(64), "fr");
    const files = fs.readdirSync(process.env.EMAIL_OUTBOX_DIR);
    assert.equal(files.length, 1);
    const message = JSON.parse(
      fs.readFileSync(
        path.join(process.env.EMAIL_OUTBOX_DIR, files[0]),
        "utf8",
      ),
    );
    assert.match(
      message.text,
      /http:\/\/localhost:3001\/fr\/reset-password\/c{64}/,
    );
    process.env.AUTH_URL = "https://wishi.example.test";
    assert.throws(mailConfiguration, /emailUnavailable/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
test("email delivery uses the configured HTTPS adapter without a real network request", async () => {
  const previous = {
    EMAIL_STATUS_DIR: process.env.EMAIL_STATUS_DIR,
    AUTH_URL: process.env.AUTH_URL,
    MAIL_TRANSPORT: process.env.MAIL_TRANSPORT,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    MAIL_FROM: process.env.MAIL_FROM,
  };
  const previousFetch = global.fetch;
  process.env.EMAIL_STATUS_DIR = path.join(directory, "email-status");
  process.env.AUTH_URL = "https://wishi.example.test";
  delete process.env.MAIL_TRANSPORT;
  process.env.RESEND_API_KEY = "synthetic-key";
  process.env.MAIL_FROM = "Wishi <sender@example.test>";
  const validFrom = process.env.MAIL_FROM;
  process.env.MAIL_FROM = "invalid sender";
  assert.throws(mailConfiguration, /emailUnavailable/);
  process.env.MAIL_FROM = validFrom;
  let calls = 0;
  global.fetch = async (url, options) => {
    calls++;
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer synthetic-key");
    const message = JSON.parse(options.body);
    assert.deepEqual(message.to, ["synthetic@example.test"]);
    assert.match(
      message.text,
      /https:\/\/wishi.example.test\/en\/reset-password\/f{64}/,
    );
    return new Response("{}", { status: 200 });
  };
  try {
    await sendResetMail("synthetic@example.test", "f".repeat(64), "en");
    assert.equal(calls, 1);
    global.fetch = async () => new Response("{}", { status: 500 });
    await assert.rejects(
      sendResetMail("synthetic@example.test", "f".repeat(64), "en"),
      /emailDeliveryFailed/,
    );
    const failure = JSON.parse(fs.readFileSync(path.join(process.env.EMAIL_STATUS_DIR, "failed.json"), "utf8"));
    assert.equal(failure.status, 500);
    assert.deepEqual(Object.keys(failure).sort(), ["at", "category", "outcome", "status"]);
    assert.equal(JSON.stringify(failure).includes("synthetic"), false);
    global.fetch = async () => { throw new Error("private transport detail"); };
    await assert.rejects(sendResetMail("synthetic@example.test", "f".repeat(64), "en"), /emailDeliveryFailed/);
    const network = JSON.parse(fs.readFileSync(path.join(process.env.EMAIL_STATUS_DIR, "failed.json"), "utf8"));
    assert.equal(network.category, "network");
    assert.equal(JSON.stringify(network).includes("private transport"), false);
    assert.equal(fs.existsSync(path.join(process.env.EMAIL_STATUS_DIR, "accepted.json")), true);
    delete process.env.RESEND_API_KEY;
    assert.throws(mailConfiguration, /emailUnavailable/);
  } finally {
    global.fetch = previousFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
