import type { PrismaClient } from "@wishi/prisma-client";
import { canReadWishlist, hashShareToken } from "./wishlist-service";
import {
  createReadAccessChecker,
  createFamilyMembershipLoader,
} from "./read-access-checker";
export async function readReminders(
  db: PrismaClient,
  userId: string,
  now = new Date(),
  options: { email?: boolean } = {},
) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (kind: string) => parts.find((p) => p.type === kind)!.value;
  const today = new Date(
    `${part("year")}-${part("month")}-${part("day")}T00:00:00Z`,
  );
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + 15);
  const familyOwners = createFamilyMembershipLoader(db, userId);
  const canRead = createReadAccessChecker((list, token) =>
    canReadWishlist(db, list, userId, token, familyOwners),
  );
  const giftQuery = {
    where: {
      userId,
      item: {
        deletedAt: null,
        wishlist: {
          ownerId: { not: userId },
          archivedAt: null,
          deletedAt: null,
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
    ...(options.email ? {} : { take: 200 }),
    include: {
      item: {
        include: {
          wishlist: {
            include: {
              event: { select: { date: true } },
              recipient: { select: { name: true } },
              owner: { select: { name: true } },
            },
          },
        },
      },
    },
  };
  const [events, reservations, contributions, lists, incompleteLists] =
    await Promise.all([
      db.event.findMany({
        where: {
          date: { gte: today, lt: end },
          family: { members: { some: { userId } } },
        },
        orderBy: { date: "asc" },
        ...(options.email ? {} : { take: 10 }),
        select: { id: true, name: true, date: true },
      }),
      db.reservation.findMany(giftQuery),
      db.contribution.findMany(giftQuery),
      db.wishlist.findMany({
        where: {
          ownerId: userId,
          archivedAt: null,
          deletedAt: null,
          ...(options.email ? {} : { items: { some: { deletedAt: null } } }),
          neededBy: {
            gte: today.toISOString().slice(0, 10),
            lt: end.toISOString().slice(0, 10),
          },
        },
        ...(options.email ? {} : { take: 3 }),
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          neededBy: true,
          _count: { select: { items: { where: { deletedAt: null } } } },
        },
      }),
      options.email
        ? Promise.resolve([])
        : db.wishlist.findMany({
            where: {
              ownerId: userId,
              archivedAt: null,
              deletedAt: null,
              items: { none: { deletedAt: null } },
            },
            take: 3,
            orderBy: { updatedAt: "desc" },
            select: { id: true, name: true },
          }),
    ]);
  const gifts = [];
  const seen = new Set<string>();
  const participations = [
    ...contributions.map((row) => ({ ...row, kind: "contribution" as const })),
    ...reservations.map((row) => ({ ...row, kind: "reservation" as const })),
  ];
  for (const participation of participations) {
    const { item, accessTokenHash, kind } = participation,
      list = item.wishlist;
    if (seen.has(item.id) || (kind === "contribution" && !item.isGroupGift))
      continue;
    const token =
      list.visibility === "LINK" &&
      list.shareToken &&
      accessTokenHash === hashShareToken(list.shareToken)
        ? list.shareToken
        : undefined;
    if (!(await canRead(list, token))) continue;
    const due = list.neededBy
      ? new Date(list.neededBy + "T12:00:00Z")
      : list.event?.date || null;
    if ((!due && !options.email) || (due && (due < today || due >= end)))
      continue;
    seen.add(item.id);
    gifts.push({
      id: item.id,
      kind,
      title: item.title,
      recipient: list.recipient?.name || list.owner.name || "—",
      due,
      href: token ? `/share/${token}` : `/dashboard/wishlists/${list.id}`,
    });
  }
  gifts.sort(
    (a, b) => (a.due?.getTime() || Infinity) - (b.due?.getTime() || Infinity),
  );
  return {
    events,
    gifts: options.email ? gifts : gifts.slice(0, 12),
    lists,
    incompleteLists,
  };
}
