import type { PrismaClient } from "@wishi/prisma-client";

export const manualGiftOrder = [
  { position: "asc" },
  { createdAt: "desc" },
  { id: "asc" },
] as const;

export async function moveGift(
  db: PrismaClient,
  itemId: string,
  userId: string,
  direction: "up" | "down",
) {
  if (!["up", "down"].includes(direction)) return { error: "invalidFields" };
  try {
    return await db.$transaction(async (tx) => {
      // Acquire SQLite's write lock before reading the order so concurrent moves serialize.
      const locked = await tx.wishlist.updateMany({
        where: {
          ownerId: userId,
          archivedAt: null,
          deletedAt: null,
          items: { some: { id: itemId, deletedAt: null } },
        },
        data: { updatedAt: new Date() },
      });
      if (!locked.count) return { error: "forbidden" };
      const item = await tx.wishlistItem.findUniqueOrThrow({
        where: { id: itemId },
      });
      const items = await tx.wishlistItem.findMany({
        where: { wishlistId: item.wishlistId, deletedAt: null },
        orderBy: [...manualGiftOrder],
        select: { id: true },
      });
      const index = items.findIndex((gift) => gift.id === itemId);
      const next = index + (direction === "up" ? -1 : 1);
      if (next < 0 || next >= items.length) return { success: true };
      [items[index], items[next]] = [items[next], items[index]];
      for (const [position, gift] of items.entries()) {
        await tx.wishlistItem.update({
          where: { id: gift.id },
          data: { position },
        });
      }
      return { success: true };
    });
  } catch {
    // A conflicting transaction never leaves a partially saved order.
    return { error: "unexpected" };
  }
}
