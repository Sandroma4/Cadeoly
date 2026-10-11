import type { PrismaClient, Prisma } from "@wishi/prisma-client";

export async function searchDashboard(
  db: PrismaClient,
  userId: string,
  input: string,
) {
  const query = input.trim().slice(0, 120);
  if (query.length < 2) return { lists: [], gifts: [], events: [] };
  const access: Prisma.WishlistWhereInput = {
    deletedAt: null,
    OR: [
      { ownerId: userId },
      { archivedAt: null, visibility: "PUBLIC" },
      {
        archivedAt: null,
        visibility: "FAMILY",
        owner: {
          familyMembers: {
            some: { family: { members: { some: { userId } } } },
          },
        },
      },
    ],
  };
  const [lists, gifts, events] = await Promise.all([
    db.wishlist.findMany({
      where: { AND: [access, { name: { contains: query } }] },
      select: { id: true, name: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 25,
    }),
    db.wishlistItem.findMany({
      where: { deletedAt: null, title: { contains: query }, wishlist: access },
      select: {
        id: true,
        title: true,
        wishlistId: true,
        wishlist: { select: { name: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 25,
    }),
    db.event.findMany({
      where: {
        name: { contains: query },
        family: { members: { some: { userId } } },
      },
      select: { id: true, name: true, date: true },
      orderBy: [{ date: "desc" }, { id: "asc" }],
      take: 25,
    }),
  ]);
  return {
    lists: lists.map((list) => ({
      id: list.id,
      title: list.name,
      href: `/dashboard/wishlists/${list.id}`,
    })),
    gifts: gifts.map((gift) => ({
      id: gift.id,
      title: gift.title,
      listName: gift.wishlist.name,
      href: `/dashboard/wishlists/${gift.wishlistId}?q=${encodeURIComponent(gift.title)}`,
    })),
    events: events.map((event) => ({
      id: event.id,
      title: event.name,
      date: event.date,
      href: `/dashboard/events/${event.id}`,
    })),
  };
}
