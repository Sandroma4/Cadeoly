import type { PrismaClient } from "@wishi/prisma-client";
import { createHash, createHmac, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { passwordSchema } from "./validation";
export const resetTokenHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const duration = 30 * 60 * 1000;
export async function requestReset(
  db: PrismaClient,
  email: string,
  send: (token: string) => Promise<void>,
  secret: string,
  now = new Date(),
) {
  const globalKey = `global:${Math.floor(now.getTime() / (60 * 60 * 1000))}`;
  const globalThrottle = await db.authRequestThrottle.upsert({
    where: { key: globalKey },
    create: { key: globalKey, windowStart: now, attempts: 1 },
    update: { attempts: { increment: 1 } },
  });
  if (globalThrottle.attempts > 1000) return;
  const key = createHmac("sha256", secret).update(email).digest("hex");
  const bucket = Math.floor(now.getTime() / (15 * 60 * 1000));
  const throttleKey = `${key}:${bucket}`;
  await db.authRequestThrottle.deleteMany({
    where: {
      windowStart: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    },
  });
  const throttle = await db.authRequestThrottle.upsert({
    where: { key: throttleKey },
    create: { key: throttleKey, windowStart: now, attempts: 1 },
    update: { attempts: { increment: 1 } },
  });
  if (throttle.attempts > 3) return;
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) return;
  const token = randomBytes(32).toString("hex");
  const tokenHash = resetTokenHash(token);
  await db.passwordResetToken.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      tokenHash,
      expires: new Date(now.getTime() + duration),
    },
    update: {
      tokenHash,
      expires: new Date(now.getTime() + duration),
      createdAt: now,
    },
  });
  try {
    await send(token);
  } catch {
    await db.passwordResetToken.deleteMany({ where: { tokenHash } });
    console.error("Password recovery email delivery failed");
  }
}
export async function validResetToken(
  db: PrismaClient,
  token: string,
  now = new Date(),
) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  return Boolean(
    await db.passwordResetToken.findFirst({
      where: { tokenHash: resetTokenHash(token), expires: { gt: now } },
      select: { id: true },
    }),
  );
}
export async function resetPassword(
  db: PrismaClient,
  token: string,
  password: string,
  now?: Date,
) {
  const clock = () => now || new Date();
  if (!passwordSchema.safeParse(password).success)
    return { error: "invalidFields" };
  if (!(await validResetToken(db, token, clock())))
    return { error: "invalidResetLink" };
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: resetTokenHash(token) },
  });
  if (!record) return { error: "invalidResetLink" };
  const hash = await bcrypt.hash(password, 12);
  return db.$transaction(async (tx) => {
    // Claim with the first write, avoiding simultaneous SQLite read-to-write lock upgrades.
    const deleted = await tx.passwordResetToken.deleteMany({
      where: {
        id: record.id,
        tokenHash: record.tokenHash,
        expires: { gt: clock() },
      },
    });
    if (!deleted.count) return { error: "invalidResetLink" };
    await tx.user.update({
      where: { id: record.userId },
      data: { password: hash, sessionVersion: { increment: 1 } },
    });
    return { success: true };
  });
}
export async function sessionIsCurrent(
  db: PrismaClient,
  userId: string,
  version: unknown,
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true },
  });
  return Boolean(user && user.sessionVersion === (version ?? 0));
}
