require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test, after } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { DatabaseSync } = require("node:sqlite"),
  { PrismaClient } = require("@wishi/prisma-client");
const {
  runEmailReminders,
  parseEmailReminderSettings,
} = require("../src/lib/email-reminders.ts");
const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "cadeoly-email-reminders-"),
  ),
  file = path.join(directory, "test.db"),
  sql = new DatabaseSync(file);
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
after(async () => {
  await db.$disconnect();
  fs.rmSync(directory, { recursive: true, force: true });
});
const now = new Date("2026-10-09T10:00:00Z");
test("settings require explicit consent and a supported lead time", () => {
  const form = new FormData();
  form.set("emailReminderDays", "3");
  assert.deepEqual(parseEmailReminderSettings(form), {
    emailRemindersEnabled: false,
    emailReminderDays: 3,
  });
  form.set("emailRemindersEnabled", "on");
  assert.equal(parseEmailReminderSettings(form).emailRemindersEnabled, true);
  form.set("emailReminderDays", "-1");
  assert.throws(() => parseEmailReminderSettings(form));
});
test("emails require consent, due window and access; delivery is deduplicated and disabling stops future mail", async () => {
  const owner = await db.user.create({ data: { name: "Owner" } }),
    viewer = await db.user.create({ data: { email: "viewer@example.test" } });
  const list = await db.wishlist.create({
    data: {
      name: "Wishes",
      ownerId: owner.id,
      visibility: "PUBLIC",
      neededBy: "2026-10-12",
    },
  });
  const item = await db.wishlistItem.create({
    data: {
      title: "Gift",
      wishlistId: list.id,
      reservations: { create: { userId: viewer.id } },
    },
  });
  let sent = 0;
  const send = async () => {
    sent++;
  };
  await runEmailReminders(db, send, now);
  assert.equal(sent, 0);
  await db.user.update({
    where: { id: viewer.id },
    data: { emailRemindersEnabled: true, emailReminderDays: 1 },
  });
  await runEmailReminders(db, send, now);
  assert.equal(sent, 0);
  await db.user.update({
    where: { id: viewer.id },
    data: { emailReminderDays: 3 },
  });
  await db.wishlist.update({
    where: { id: list.id },
    data: { visibility: "PRIVATE" },
  });
  await runEmailReminders(db, send, now);
  assert.equal(sent, 0);
  await db.wishlist.update({
    where: { id: list.id },
    data: { visibility: "PUBLIC" },
  });
  await Promise.all([
    runEmailReminders(db, send, now),
    runEmailReminders(db, send, now),
  ]);
  assert.equal(sent, 1);
  await runEmailReminders(db, send, now);
  assert.equal(sent, 1);
  await db.wishlist.update({
    where: { id: list.id },
    data: { neededBy: "2026-10-13" },
  });
  await db.user.update({
    where: { id: viewer.id },
    data: { emailRemindersEnabled: false },
  });
  await runEmailReminders(db, send, new Date("2026-10-10T10:00:00Z"));
  assert.equal(sent, 1);
  await db.wishlistItem.delete({ where: { id: item.id } });
});
test("failed deliveries retry after their lease expires", async () => {
  const owner = await db.user.create({ data: { name: "Owner" } }),
    viewer = await db.user.create({
      data: { email: "retry@example.test", emailRemindersEnabled: true },
    });
  await db.wishlist.create({
    data: {
      name: "Retry",
      ownerId: owner.id,
      visibility: "PUBLIC",
      neededBy: "2026-10-12",
      items: {
        create: {
          title: "Retry gift",
          reservations: { create: { userId: viewer.id } },
        },
      },
    },
  });
  const result = await runEmailReminders(
    db,
    async () => {
      throw Error("offline");
    },
    now,
  );
  assert.equal(result.failed, 1);
  let sent = 0;
  await runEmailReminders(
    db,
    async () => {
      sent++;
    },
    now,
  );
  assert.equal(sent, 0);
  await runEmailReminders(
    db,
    async () => {
      sent++;
    },
    new Date("2026-10-09T10:21:00Z"),
  );
  assert.equal(sent, 1);
});

test("email scope includes candidates beyond dashboard caps and continues after a failed email", async () => {
  const owner = await db.user.create({ data: { name: "Bulk owner" } });
  const viewer = await db.user.create({
    data: { email: "bulk@example.test", emailRemindersEnabled: true },
  });
  await db.family.create({
    data: {
      name: "Bulk family",
      ownerId: owner.id,
      members: { create: [{ userId: viewer.id }] },
      events: {
        create: Array.from({ length: 11 }, (_, i) => ({
          name: `Event ${i}`,
          date: new Date("2026-10-12T12:00:00Z"),
        })),
      },
    },
  });
  await db.wishlist.create({
    data: {
      name: "Bulk gifts",
      ownerId: owner.id,
      visibility: "PUBLIC",
      neededBy: "2026-10-12",
      items: {
        create: Array.from({ length: 14 }, (_, i) => ({
          title: `Gift ${i}`,
          reservations: { create: { userId: viewer.id } },
        })),
      },
    },
  });
  for (let i = 0; i < 4; i++)
    await db.wishlist.create({
      data: { name: `Owned ${i}`, ownerId: viewer.id, neededBy: "2026-10-12" },
    });
  let attempts = 0;
  const result = await runEmailReminders(
    db,
    async (message) => {
      if (message.email !== viewer.email) return;
      attempts++;
      if (attempts === 1) throw Error("temporary delivery failure");
    },
    now,
  );
  assert.equal(attempts, 29);
  assert.equal(result.failed, 1);
});
