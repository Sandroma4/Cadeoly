import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "@wishi/prisma-client";
import { canReadWishlist, hashShareToken } from "./wishlist-service";

export const guestReservationSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  message: z.string().trim().max(1000).default(""),
});
export const managementToken = (id: string, secret: string) =>
  createHmac("sha256", secret)
    .update("guest-reservation:" + id)
    .digest("base64url");
export function ownsGuestReservation(
  row: { guestSessionHash: string | null; userId: string | null },
  sessionHash?: string,
) {
  return (
    !row.userId && Boolean(sessionHash && row.guestSessionHash === sessionHash)
  );
}
export async function reserveGuestGift(
  db: PrismaClient,
  itemId: string,
  token: string | undefined,
  input: unknown,
  sessionHash: string,
  secret: string,
) {
  const parsed = guestReservationSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidFields" } as const;
  const item = await db.wishlistItem.findUnique({
    where: { id: itemId },
    include: { wishlist: true },
  });
  if (
    !item ||
    item.deletedAt ||
    item.isGroupGift ||
    !(await canReadWishlist(db, item.wishlist, undefined, token))
  )
    return { error: "forbidden" } as const;
  const existing = await db.reservation.findUnique({ where: { itemId } });
  if (existing && ownsGuestReservation(existing, sessionHash))
    return { id: existing.id };
  const id = randomUUID();
  try {
    await db.reservation.create({
      data: {
        id,
        itemId,
        guestFirstName: parsed.data.firstName,
        guestEmail: parsed.data.email,
        personalMessage: parsed.data.message || null,
        guestSessionHash: sessionHash,
        managementTokenHash: hashShareToken(managementToken(id, secret)),
        managementExpiresAt: new Date(Date.now() + 365 * 86400000),
        accessTokenHash:
          item.wishlist.visibility === "LINK" && token
            ? hashShareToken(token)
            : null,
      },
    });
    return { id };
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "P2002"
    )
      return { error: "alreadyReserved" } as const;
    throw error;
  }
}
