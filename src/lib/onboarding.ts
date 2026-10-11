import type { PrismaClient } from "@wishi/prisma-client";

export async function readOnboarding(
  db: PrismaClient,
  userId: string,
  now = new Date(),
) {
  const activeWishlist = { ownerId: userId, archivedAt: null, deletedAt: null };
  const [list, gifts, family] = await Promise.all([
    db.wishlist.findFirst({
      where: activeWishlist,
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    db.wishlistItem.count({
      where: { deletedAt: null, wishlist: activeWishlist },
    }),
    db.family.findFirst({
      where: {
        ownerId: userId,
        OR: [
          { invitations: { some: { expires: { gt: now } } } },
          { members: { some: { userId: { not: userId } } } },
        ],
      },
      select: { id: true },
    }),
  ]);
  return {
    listId: list?.id ?? null,
    gifts: Math.min(gifts, 3),
    relativeInvited: Boolean(family),
    complete: Boolean(list) && gifts >= 3 && Boolean(family),
  };
}
