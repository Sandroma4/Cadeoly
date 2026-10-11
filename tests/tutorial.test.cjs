const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

test("tutorial completion persists per account without changing existing user data", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const directory = path.join(__dirname, "../prisma/migrations");
    const migrations = fs
      .readdirSync(directory)
      .filter((name) => /^\d/.test(name))
      .sort();
    const tutorial = migrations.find((name) =>
      name.endsWith("_account_tutorial"),
    );
    assert.ok(tutorial, "A migration must persist tutorial completion");
    for (const migration of migrations.filter((name) => name !== tutorial)) {
      db.exec(
        fs.readFileSync(
          path.join(directory, migration, "migration.sql"),
          "utf8",
        ),
      );
    }
    db.exec(`INSERT INTO User (id, name, email, updatedAt) VALUES
      ('first', 'First', 'first@example.test', CURRENT_TIMESTAMP),
      ('second', 'Second', 'second@example.test', CURRENT_TIMESTAMP)`);
    db.exec(
      fs.readFileSync(path.join(directory, tutorial, "migration.sql"), "utf8"),
    );
    assert.equal(
      db
        .prepare("SELECT tutorialCompletedAt FROM User WHERE id = ?")
        .get("first").tutorialCompletedAt,
      null,
    );
    const complete = db.prepare(
      "UPDATE User SET tutorialCompletedAt = ? WHERE id = ? AND tutorialCompletedAt IS NULL",
    );
    assert.equal(complete.run("2026-10-10T12:00:00Z", "first").changes, 1);
    assert.equal(complete.run("2026-10-11T12:00:00Z", "first").changes, 0);
    assert.equal(
      db
        .prepare("SELECT tutorialCompletedAt FROM User WHERE id = ?")
        .get("first").tutorialCompletedAt,
      "2026-10-10T12:00:00Z",
    );
    const untouched = db
      .prepare("SELECT name, email, tutorialCompletedAt FROM User WHERE id = ?")
      .get("second");
    assert.deepEqual(
      { ...untouched },
      {
        name: "Second",
        email: "second@example.test",
        tutorialCompletedAt: null,
      },
    );
  } finally {
    db.close();
  }
});
