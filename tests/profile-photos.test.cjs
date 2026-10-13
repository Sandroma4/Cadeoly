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
const sharp = require("sharp");
const {
  updateProfilePhoto,
  canReadProfilePhoto,
} = require("../src/lib/profile-photos.ts");
const { readGiftPhoto } = require("../src/lib/gift-photos.ts");
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "cadeoly-avatar-test-"),
);
process.env.UPLOAD_DIR = path.join(directory, "photos");
const database = path.join(directory, "test.db");
const sql = new DatabaseSync(database);
for (const migration of fs
  .readdirSync("prisma/migrations")
  .filter((name) => /^\d/.test(name))
  .sort()) {
  sql.exec(
    fs.readFileSync(
      path.join("prisma/migrations", migration, "migration.sql"),
      "utf8",
    ),
  );
}
sql.close();
const db = new PrismaClient({
  datasources: { db: { url: `file:${database.replaceAll("\\", "/")}` } },
});
after(async () => {
  await db.$disconnect();
  fs.rmSync(directory, { recursive: true, force: true });
});

test("profile photos enforce visibility, validate uploads, replace and remove files", async () => {
  for (const id of ["owner", "relative", "other"])
    await db.user.create({ data: { id, name: id } });
  await db.family.create({
    data: {
      name: "Family",
      ownerId: "owner",
      members: {
        create: [{ userId: "owner", role: "ADMIN" }, { userId: "relative" }],
      },
    },
  });
  const bytes = await sharp({
    create: { width: 24, height: 24, channels: 3, background: "purple" },
  })
    .png()
    .toBuffer();
  const form = (visibility, file) => {
    const data = new FormData();
    data.set("visibility", visibility);
    if (file) data.set("photo", file);
    return data;
  };
  const file = () => new File([bytes], "avatar.png", { type: "image/png" });
  assert.deepEqual(
    await updateProfilePhoto(db, "owner", form("INVALID", file())),
    { error: "invalidFields" },
  );
  assert.equal(
    (await updateProfilePhoto(db, "owner", form("PRIVATE", file()))).success,
    true,
  );
  const first = await db.user.findUnique({ where: { id: "owner" } });
  assert.ok(await readGiftPhoto(first.profilePhoto));
  assert.equal(await canReadProfilePhoto(db, "owner", "owner"), true);
  assert.equal(await canReadProfilePhoto(db, "owner", "relative"), false);
  assert.equal(await canReadProfilePhoto(db, "owner", undefined), false);
  await updateProfilePhoto(db, "owner", form("FAMILY"));
  assert.equal(await canReadProfilePhoto(db, "owner", "relative"), true);
  assert.equal(await canReadProfilePhoto(db, "owner", "other"), false);
  assert.deepEqual(
    await updateProfilePhoto(
      db,
      "owner",
      form(
        "MEMBERS",
        new File(["<svg />"], "bad.svg", { type: "image/svg+xml" }),
      ),
    ),
    { error: "invalidPhoto" },
  );
  assert.equal(
    (await db.user.findUnique({ where: { id: "owner" } })).profilePhoto,
    first.profilePhoto,
  );
  await updateProfilePhoto(db, "owner", form("MEMBERS", file()));
  assert.equal(await readGiftPhoto(first.profilePhoto), null);
  assert.equal(await canReadProfilePhoto(db, "owner", "other"), true);
  assert.equal(await canReadProfilePhoto(db, "owner", undefined), false);
  await db.familyMember.deleteMany({ where: { userId: "relative" } });
  await updateProfilePhoto(db, "owner", form("FAMILY"));
  assert.equal(await canReadProfilePhoto(db, "owner", "relative"), false);
  const current = (await db.user.findUnique({ where: { id: "owner" } }))
    .profilePhoto;
  const remove = new FormData();
  remove.set("operation", "remove");
  assert.equal((await updateProfilePhoto(db, "owner", remove)).success, true);
  assert.equal(await readGiftPhoto(current), null);
  assert.equal(
    (await db.user.findUnique({ where: { id: "owner" } })).profilePhoto,
    null,
  );
});
