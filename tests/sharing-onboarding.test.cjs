require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { PrismaClient } = require("@wishi/prisma-client");
const { readOnboarding } = require("../src/lib/onboarding.ts");
const { socialShareUrl } = require("../src/lib/social-sharing.ts");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cadeoly-onboarding-"));
const file = path.join(directory, "test.db");
const sql = new DatabaseSync(file);
for (const migration of fs
  .readdirSync(path.join(__dirname, "../prisma/migrations"))
  .filter((name) => /^\d/.test(name))
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
  if (
    path.dirname(directory) === os.tmpdir() &&
    path.basename(directory).startsWith("cadeoly-onboarding-")
  ) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
const now = new Date("2026-10-10T12:00:00Z");
async function fixture() {
  const user = await db.user.create({ data: {} });
  const relative = await db.user.create({ data: {} });
  const list = await db.wishlist.create({
    data: { ownerId: user.id, name: "Birthday" },
  });
  await db.wishlistItem.createMany({
    data: [1, 2, 3].map((n) => ({ wishlistId: list.id, title: `Gift ${n}` })),
  });
  const family = await db.family.create({
    data: {
      ownerId: user.id,
      name: "Family",
      members: { create: { userId: user.id } },
    },
  });
  return { user, relative, list, family };
}
test("share channels preserve localized text, title, and absolute private URL", () => {
  const title = "L’été & cadeaux ?";
  const message = `${title}\nhttps://cadeoly.test/fr/share/private-token?x=1&y=2`;
  const whatsapp = new URL(socialShareUrl("whatsapp", title, message));
  assert.equal(whatsapp.origin, "https://wa.me");
  assert.equal(whatsapp.searchParams.get("text"), message);
  const email = new URL(socialShareUrl("email", title, message));
  assert.equal(email.searchParams.get("subject"), title);
  assert.equal(email.searchParams.get("body"), message);
  assert.equal(
    socialShareUrl("sms", title, message),
    "sms:?body=" + encodeURIComponent(message),
  );
  assert.equal(
    socialShareUrl("sms", title, message, true),
    "sms:&body=" + encodeURIComponent(message),
  );
});
test("pending active invitation completes all three steps", async () => {
  const { user, list, family } = await fixture();
  await db.invitation.create({
    data: {
      familyId: family.id,
      email: "relative@example.test",
      token: family.id,
      expires: new Date(now.getTime() + 1000),
    },
  });
  assert.deepEqual(await readOnboarding(db, user.id, now), {
    listId: list.id,
    gifts: 3,
    relativeInvited: true,
    complete: true,
  });
});
test("accepted invitations remain complete via another member", async () => {
  const { user, relative, family } = await fixture();
  await db.familyMember.create({
    data: { familyId: family.id, userId: relative.id },
  });
  assert.equal((await readOnboarding(db, user.id, now)).complete, true);
});
test("expired invitation and owner's own membership do not complete relative step", async () => {
  const { user, family } = await fixture();
  await db.invitation.create({
    data: {
      familyId: family.id,
      email: "relative@example.test",
      token: family.id,
      expires: now,
    },
  });
  const progress = await readOnboarding(db, user.id, now);
  assert.equal(progress.relativeInvited, false);
  assert.equal(progress.complete, false);
});
test("active gifts exclude deleted gifts and archived or deleted lists", async () => {
  const { user, list } = await fixture();
  const gift = await db.wishlistItem.findFirst({
    where: { wishlistId: list.id },
  });
  await db.wishlistItem.update({
    where: { id: gift.id },
    data: { deletedAt: now },
  });
  for (const state of [{ archivedAt: now }, { deletedAt: now }]) {
    await db.wishlist.create({
      data: {
        name: "Inactive",
        ownerId: user.id,
        ...state,
        items: { create: [{ title: "Hidden" }] },
      },
    });
  }
  assert.equal((await readOnboarding(db, user.id, now)).gifts, 2);
  await db.wishlist.update({
    where: { id: list.id },
    data: { archivedAt: now },
  });
  const progress = await readOnboarding(db, user.id, now);
  assert.equal(progress.listId, null);
  assert.equal(progress.gifts, 0);
});
test("another user's lists, gifts and invitations cannot complete onboarding", async () => {
  const { user, relative, family } = await fixture();
  await db.invitation.create({
    data: {
      familyId: family.id,
      email: "relative@example.test",
      token: family.id,
      expires: new Date(now.getTime() + 1000),
    },
  });
  await db.familyMember.create({
    data: { familyId: family.id, userId: relative.id },
  });
  assert.deepEqual(await readOnboarding(db, relative.id, now), {
    listId: null,
    gifts: 0,
    relativeInvited: false,
    complete: false,
  });
  assert.equal((await readOnboarding(db, user.id, now)).complete, true);
});
