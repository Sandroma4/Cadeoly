import type { Prisma, PrismaClient } from "@wishi/prisma-client";
import { accessibleGiftIdea } from "./gift-favorites";
export async function readGiftIdeas(db: PrismaClient, userId: string) {
  const select = {
    id: true,
    createdAt: true,
    title: true,
    description: true,
    url: true,
    priceCents: true,
    currency: true,
    priority: true,
    image: true,
    size: true,
    color: true,
    model: true,
    isGroupGift: true,
    favorites: { where: { userId }, select: { id: true } },
    reservations: { select: { userId: true } },
    contributions: { select: { amountCents: true } },
    wishlist: {
      select: {
        id: true,
        name: true,
        recipient: { select: { name: true } },
        owner: { select: { name: true } },
        event: { select: { name: true, date: true } },
      },
    },
  } satisfies Prisma.WishlistItemSelect;
  const [discovery, saved] = await Promise.all([
    db.wishlistItem.findMany({
      where: { ...accessibleGiftIdea(userId), reservations: { none: {} } },
      take: 500,
      orderBy: { createdAt: "desc" },
      select,
    }),
    db.wishlistItem.findMany({
      where: { ...accessibleGiftIdea(userId), favorites: { some: { userId } } },
      orderBy: { createdAt: "desc" },
      select,
    }),
  ]);
  const items = [
    ...new Map(
      [...discovery, ...saved].map((item) => [item.id, item]),
    ).values(),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return items
    .filter(
      (i) =>
        i.favorites.length > 0 ||
        !i.isGroupGift ||
        !i.priceCents ||
        i.contributions.reduce((sum, c) => sum + c.amountCents, 0) <
          i.priceCents,
    )
    .map((item) => {
      const { contributions, favorites, reservations, ...gift } = item;
      return {
        ...gift,
        isFavorite: favorites.length > 0,
        isReserved:
          reservations.length > 0 ||
          (item.isGroupGift &&
            !!item.priceCents &&
            contributions.reduce((sum, c) => sum + c.amountCents, 0) >=
              item.priceCents),
        reservedByMe: reservations.some(
          (reservation) => reservation.userId === userId,
        ),
      };
    });
}
