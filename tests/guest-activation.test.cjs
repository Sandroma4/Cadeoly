require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  guestOwner,
  newGuestSession,
  parseGuestIdea,
  attachGuestLists,
} = require("../src/lib/guest-list-service.ts");

test("first wish accepts a name or HTTP link without requiring an identity", () => {
  assert.equal(parseGuestIdea("  Un vélo  ").data.title, "Un vélo");
  assert.equal(
    parseGuestIdea("https://example.com/gift").data.url,
    "https://example.com/gift",
  );
  assert.equal(
    parseGuestIdea("https://example.com/gift").data.title,
    "example.com",
  );
  assert.equal(parseGuestIdea(" ").success, false);
  assert.equal(parseGuestIdea("https://").success, false);
  assert.equal(parseGuestIdea("x".repeat(121)).success, false);
});

test("sign-in moves only this guest's lists and revokes their private access", async () => {
  const { PrismaClient } = require("@wishi/prisma-client");
  const { DatabaseSync } = require("node:sqlite");
  const fs = require("node:fs"),
    path = require("node:path"),
    os = require("node:os");
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "cadeoly-guest-claim-"),
  );
  const file = path.join(directory, "test.db");
  const sql = new DatabaseSync(file);
  for (const name of fs
    .readdirSync(path.join(__dirname, "../prisma/migrations"))
    .filter((name) => /^\d/.test(name))
    .sort())
    sql.exec(
      fs.readFileSync(
        path.join(__dirname, "../prisma/migrations", name, "migration.sql"),
        "utf8",
      ),
    );
  sql.close();
  const db = new PrismaClient({
    datasources: { db: { url: "file:" + file.replaceAll("\\", "/") } },
  });
  try {
    const session = newGuestSession();
    const guest = await db.user.create({
      data: { guestTokenHash: session.hash, guestExpiresAt: session.expires },
    });
    const other = await db.user.create({ data: { name: "Other visitor" } });
    const user = await db.user.create({
      data: { name: "Camille", email: "camille@example.test" },
    });
    const list = await db.wishlist.create({
      data: {
        name: "Guest wishes",
        ownerId: guest.id,
        visibility: "LINK",
        shareToken: "public-link",
        items: { create: { title: "Book" } },
      },
    });
    const otherList = await db.wishlist.create({
      data: { name: "Other wishes", ownerId: other.id },
    });
    assert.equal(await attachGuestLists(db, user.id, "invalid"), 0);
    assert.equal(
      await attachGuestLists(
        db,
        user.id,
        session.token,
        new Date(session.expires.getTime() + 1),
      ),
      0,
    );
    assert.equal(await attachGuestLists(db, user.id, session.token), 1);
    assert.equal(await guestOwner(db, session.token), null);
    assert.equal(await attachGuestLists(db, user.id, session.token), 0);
    const saved = await db.wishlist.findUnique({
      where: { id: list.id },
      include: { items: true },
    });
    assert.equal(saved.ownerId, user.id);
    assert.equal(saved.shareToken, "public-link");
    assert.equal(saved.items[0].title, "Book");
    assert.equal(
      (await db.wishlist.findUnique({ where: { id: otherList.id } })).ownerId,
      other.id,
    );
  } finally {
    await db.$disconnect();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
