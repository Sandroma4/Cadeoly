import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@wishi/prisma-client";
import { itemSchema } from "./validation";

export const guestListCookie = "cadeoly-guest-lists";
export const guestListMaxAge = 365 * 86400;
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export function newGuestSession() {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    hash: hash(token),
    expires: new Date(Date.now() + guestListMaxAge * 1000),
  };
}

export async function guestOwner(
  db: PrismaClient,
  token?: string,
  now = new Date(),
) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db.user.findFirst({
    where: {
      guestTokenHash: hash(token),
      guestExpiresAt: { gt: now },
      email: null,
      password: null,
    },
    select: { id: true },
  });
}

export function parseGuestIdea(value: unknown) {
  const idea = typeof value === "string" ? value.trim() : "";
  let title = idea;
  let url = "";
  if (/^https?:\/\//i.test(idea)) {
    try {
      const link = new URL(idea);
      title = link.hostname.slice(0, 120);
      url = idea;
    } catch {
      title = "";
    }
  }
  return itemSchema.safeParse({ title, url, price: "", priority: "NORMAL" });
}

export async function attachGuestLists(
  db: PrismaClient,
  userId: string,
  token?: string,
  now = new Date(),
) {
  const owner = await guestOwner(db, token, now);
  if (!owner || owner.id === userId) return 0;
  return db.$transaction(async (tx) => {
    const claimed = await tx.user.updateMany({
      where: {
        id: owner.id,
        guestTokenHash: hash(token!),
        guestExpiresAt: { gt: now },
        email: null,
        password: null,
      },
      data: { guestTokenHash: null, guestExpiresAt: null },
    });
    if (!claimed.count) return 0;
    const lists = await tx.wishlist.updateMany({
      where: { ownerId: owner.id },
      data: { ownerId: userId },
    });
    return lists.count;
  });
}
