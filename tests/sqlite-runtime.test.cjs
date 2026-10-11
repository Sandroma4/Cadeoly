require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PrismaClient } = require("@wishi/prisma-client");

test("SQLite runtime enables WAL and bounded lock waiting without losing persisted data", async () => {
  const { configureSqlite } = require("../src/lib/sqlite-runtime.ts");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cadeoly-wal-"));
  const db = new PrismaClient({
    datasources: {
      db: {
        url: "file:" + path.join(directory, "test.db").replaceAll("\\", "/"),
      },
    },
  });
  try {
    await db.$executeRawUnsafe("CREATE TABLE proof (value TEXT NOT NULL)");
    await db.$executeRawUnsafe("INSERT INTO proof VALUES ('preserved')");
    await configureSqlite(db);
    await configureSqlite(db);
    assert.equal(
      (await db.$queryRawUnsafe("PRAGMA journal_mode"))[0].journal_mode,
      "wal",
    );
    assert.equal(
      (await db.$queryRawUnsafe("PRAGMA busy_timeout"))[0].timeout,
      5000n,
    );
    assert.deepEqual(await db.$queryRawUnsafe("SELECT value FROM proof"), [
      { value: "preserved" },
    ]);
  } finally {
    await db.$disconnect();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
