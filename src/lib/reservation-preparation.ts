import type { PrismaClient } from "@wishi/prisma-client";
import {
  canReadWishlist,
  hashShareToken,
  reserveGift,
} from "./wishlist-service";

export const preparationStatuses = [
  "RESERVED",
  "BOUGHT",
  "WRAPPED",
  "GIVEN",
] as const;
export type PreparationStatus = (typeof preparationStatuses)[number];
export type ReservationUndo = {
  preparationStatus: string;
  quantity: number;
  token?: string;
  personalMessage?: string;
  messageReleasedAt?: string;
};
function validStatus(status: string): status is PreparationStatus {
  return preparationStatuses.some((value) => value === status);
}
function reservationToken(
  list: { visibility: string; shareToken: string | null },
  hash: string | null,
) {
  return list.visibility === "LINK" &&
    list.shareToken &&
    hash === hashShareToken(list.shareToken)
    ? list.shareToken
    : undefined;
}
export async function updatePreparation(
  db: PrismaClient,
  itemId: string,
  userId: string,
  status: string,
) {
  if (!validStatus(status)) return { error: "invalidFields" };
  const row = await db.reservation.findFirst({
    where: { itemId, userId },
    include: { item: { include: { wishlist: true } } },
  });
  if (
    !row ||
    row.item.deletedAt ||
    row.item.wishlist.ownerId === userId ||
    !(await canReadWishlist(
      db,
      row.item.wishlist,
      userId,
      reservationToken(row.item.wishlist, row.accessTokenHash),
    ))
  )
    return { error: "forbidden" };
  const result = await db.reservation.updateMany({
    where: { id: row.id, userId },
    data: {
      preparationStatus: status,
      ...(status === "GIVEN" ? { messageReleasedAt: new Date() } : {}),
    },
  });
  return result.count ? { success: true } : { error: "forbidden" };
}
export async function cancelWithUndo(
  db: PrismaClient,
  itemId: string,
  userId: string,
) {
  return db.$transaction(async (tx) => {
    const row = await tx.reservation.findFirst({
      where: { itemId, userId },
      include: { item: { include: { wishlist: true } } },
    });
    if (!row) return { error: "forbidden" };
    const removed = await tx.reservation.deleteMany({
      where: { id: row.id, userId },
    });
    if (!removed.count) return { error: "forbidden" };
    return {
      success: true,
      undo: {
        preparationStatus: row.preparationStatus,
        quantity: row.quantity,
        token: reservationToken(row.item.wishlist, row.accessTokenHash),
        ...(row.personalMessage
          ? { personalMessage: row.personalMessage }
          : {}),
        ...(row.messageReleasedAt
          ? { messageReleasedAt: row.messageReleasedAt.toISOString() }
          : {}),
      },
    };
  });
}
export async function undoCancellation(
  db: PrismaClient,
  itemId: string,
  userId: string,
  undo: ReservationUndo,
) {
  if (
    !undo ||
    !validStatus(undo.preparationStatus) ||
    !Number.isSafeInteger(undo.quantity) ||
    undo.quantity < 1 ||
    undo.quantity > 999 ||
    (undo.personalMessage !== undefined &&
      (typeof undo.personalMessage !== "string" ||
        undo.personalMessage.length > 1000)) ||
    (undo.messageReleasedAt !== undefined &&
      (typeof undo.messageReleasedAt !== "string" ||
        !Number.isFinite(Date.parse(undo.messageReleasedAt))))
  )
    return { error: "invalidFields" };
  // Restoring is a new reservation: current access and the unique item constraint apply.
  return reserveGift(db, itemId, userId, undo.token, undo);
}
