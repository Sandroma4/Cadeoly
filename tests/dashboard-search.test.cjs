require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { DatabaseSync } = require("node:sqlite");
const { PrismaClient } = require("@wishi/prisma-client");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cadeoly-search-"));
const file = path.join(directory, "search.db");
const sql = new DatabaseSync(file);
for (const migration of fs
  .readdirSync(path.join(__dirname, "../prisma/migrations"))
  .filter((v) => /^\d/.test(v))
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
after(async () => {
  await db.$disconnect();
  fs.rmSync(directory, { recursive: true, force: true });
});

test("global search enforces access for lists, gifts and events, including revoked family membership", async () => {
  const { searchDashboard } = require("../src/lib/dashboard-search.ts");
  const owner = await db.user.create({ data: { name: "Owner" } });
  const viewer = await db.user.create({ data: { name: "Viewer" } });
  const outsider = await db.user.create({ data: { name: "Outsider" } });
  const family = await db.family.create({
    data: {
      name: "Family",
      ownerId: owner.id,
      members: { create: [{ userId: owner.id }, { userId: viewer.id }] },
    },
  });
  const event = await db.event.create({
    data: {
      name: "Scarf gathering",
      date: new Date("2030-12-25"),
      familyId: family.id,
    },
  });
  const lists = {};
  for (const visibility of ["PRIVATE", "FAMILY", "PUBLIC", "LINK"]) {
    lists[visibility] = await db.wishlist.create({
      data: {
        name: "Scarf " + visibility,
        ownerId: owner.id,
        visibility,
        shareToken: visibility === "LINK" ? "secret-token" : null,
        items: {
          create: {
            title: "Scarf " + visibility,
            reservations: {
              create: { userId: outsider.id, preparationStatus: "BOUGHT" },
            },
          },
        },
      },
    });
  }
  await db.wishlist.create({
    data: {
      name: "Scarf archived",
      ownerId: owner.id,
      visibility: "PUBLIC",
      archivedAt: new Date(),
    },
  });
  await db.wishlist.create({
    data: {
      name: "Scarf deleted",
      ownerId: owner.id,
      visibility: "PUBLIC",
      deletedAt: new Date(),
    },
  });
  const visible = await searchDashboard(db, viewer.id, "scarf");
  assert.deepEqual(visible.lists.map((v) => v.title).sort(), [
    "Scarf FAMILY",
    "Scarf PUBLIC",
  ]);
  assert.deepEqual(visible.gifts.map((v) => v.title).sort(), [
    "Scarf FAMILY",
    "Scarf PUBLIC",
  ]);
  assert.deepEqual(
    visible.events.map((v) => v.id),
    [event.id],
  );
  assert.equal(JSON.stringify(visible).includes("BOUGHT"), false);
  assert.equal(JSON.stringify(visible).includes("secret-token"), false);
  const own = await searchDashboard(db, owner.id, "Scarf");
  assert.equal(own.lists.length, 5); // Own archived lists stay findable.
  await db.familyMember.delete({
    where: { userId_familyId: { userId: viewer.id, familyId: family.id } },
  });
  const revoked = await searchDashboard(db, viewer.id, "Scarf");
  assert.deepEqual(
    revoked.lists.map((v) => v.title),
    ["Scarf PUBLIC"],
  );
  assert.deepEqual(
    revoked.gifts.map((v) => v.title),
    ["Scarf PUBLIC"],
  );
  assert.deepEqual(revoked.events, []);
  assert.deepEqual(await searchDashboard(db, viewer.id, " "), {
    lists: [],
    gifts: [],
    events: [],
  });
});

test("global search bounds each result category and skips deleted gifts", async () => {
  const { searchDashboard } = require("../src/lib/dashboard-search.ts");
  const user = await db.user.create({ data: { name: "Large account" } });
  for (let i = 0; i < 30; i++)
    await db.wishlist.create({
      data: {
        name: `Result ${i}`,
        ownerId: user.id,
        items: {
          create: [
            { title: `Result gift ${i}` },
            { title: "Result deleted gift", deletedAt: new Date() },
          ],
        },
      },
    });
  const result = await searchDashboard(db, user.id, "Result");
  assert.equal(result.lists.length, 25);
  assert.equal(result.gifts.length, 25);
  assert.equal(
    result.gifts.some((v) => v.title === "Result deleted gift"),
    false,
  );
});
