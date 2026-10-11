import type { PrismaClient } from "@wishi/prisma-client";
import type { ActionResult } from "./action-result";
export async function changeGiftState(
  db: PrismaClient,
  id: string,
  ownerId: string,
  restore = false,
): Promise<ActionResult> {
  const result = await db.wishlistItem.updateMany({
    where: {
      id,
      deletedAt: restore ? { not: null } : null,
      wishlist: { ownerId, archivedAt: null, deletedAt: null },
    },
    data: { deletedAt: restore ? null : new Date() },
  });
  return result.count ? { success: true } : { error: "forbidden" };
}
export async function readTrashedGifts(
  db: PrismaClient,
  wishlistId: string,
  ownerId: string,
) {
  return db.wishlistItem.findMany({
    where: {
      wishlistId,
      deletedAt: { not: null },
      wishlist: { ownerId, archivedAt: null, deletedAt: null },
    },
    select: { id: true, title: true, deletedAt: true },
    orderBy: { deletedAt: "desc" },
  });
}
