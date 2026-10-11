import type { Prisma, PrismaClient } from "@wishi/prisma-client";

export function accessibleGiftIdea(
  userId: string,
): Prisma.WishlistItemWhereInput {
  return {
    deletedAt: null,
    wishlist: {
      ownerId: { not: userId },
      archivedAt: null,
      deletedAt: null,
      visibility: { in: ["FAMILY", "PUBLIC"] },
      owner: {
        familyMembers: {
          some: { family: { members: { some: { userId } } } },
        },
      },
    },
  };
}

export async function setGiftFavorite(
  db: PrismaClient,
  itemId: string,
  userId: string,
  favorite: boolean,
) {
  if (!favorite) {
    await db.giftFavorite.deleteMany({ where: { itemId, userId } });
    return { success: true };
  }
  return db.$transaction(async (tx) => {
    const item = await tx.wishlistItem.findFirst({
      where: { id: itemId, ...accessibleGiftIdea(userId) },
      select: { id: true },
    });
    if (!item) return { error: "forbidden" };
    await tx.giftFavorite.upsert({
      where: { userId_itemId: { userId, itemId } },
      create: { userId, itemId },
      update: {},
    });
    return { success: true };
  });
}
