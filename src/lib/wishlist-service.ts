import type { PrismaClient, Prisma } from "@wishi/prisma-client";
import { createHash } from "node:crypto";
import {
  defaultGiftFilters,
  selectGifts,
  giftTotals,
  paginateGifts,
  type GiftPageOptions,
  type GiftPagination,
} from "./gift-search";
import {
  createReadAccessChecker,
  createFamilyMembershipLoader,
} from "./read-access-checker";
import { manualGiftOrder } from "./gift-order-service";
import type { ActionResult } from "./action-result";
import { reportBusinessEvent } from "./observability";
export const hashShareToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function canReadWishlist(
  db: PrismaClient,
  wishlist: {
    ownerId: string;
    visibility: string;
    shareToken: string | null;
    archivedAt?: Date | null;
    deletedAt?: Date | null;
  },
  userId?: string,
  token?: string,
  familyOwners?: () => Promise<ReadonlySet<string>>,
) {
  if (wishlist.deletedAt) return false;
  if (userId === wishlist.ownerId) return true;
  if (wishlist.archivedAt) return false;
  if (wishlist.visibility === "PUBLIC") return true;
  if (wishlist.visibility === "LINK")
    return Boolean(
      token && wishlist.shareToken && token === wishlist.shareToken,
    );
  if (wishlist.visibility !== "FAMILY" || !userId) return false;
  if (familyOwners) return (await familyOwners()).has(wishlist.ownerId);
  return Boolean(
    await db.family.findFirst({
      where: {
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: wishlist.ownerId } } },
        ],
      },
      select: { id: true },
    }),
  );
}

export async function readWishlist(
  db: PrismaClient,
  id: string,
  userId?: string,
  token?: string,
  options?: GiftPageOptions,
) {
  const list = await db.wishlist.findUnique({ where: { id } });
  if (!list || !(await canReadWishlist(db, list, userId, token))) return null;
  const isOwner = list.ownerId === userId;
  const signals = !isOwner
    ? {
        contributions: {
          where:
            list.visibility === "LINK"
              ? {
                  accessTokenHash: list.shareToken
                    ? hashShareToken(list.shareToken)
                    : "invalid",
                }
              : {},
          select: { userId: true, amountCents: true },
        },
        reservations: { select: { userId: true } },
      }
    : {};
  let pagination: GiftPagination | undefined;
  let selectedIds: string[] | undefined;
  let pageWindow: { skip: number; take: number } | undefined;
  let pageOrder: Prisma.WishlistItemOrderByWithRelationInput[] = [
    ...manualGiftOrder,
  ];
  let itemWhere: Prisma.WishlistItemWhereInput = { deletedAt: null };
  const orderedIds = isOwner
    ? (
        await db.wishlistItem.findMany({
          where: { wishlistId: id, deletedAt: null },
          orderBy: [...manualGiftOrder],
          select: { id: true },
        })
      ).map((item) => item.id)
    : [];
  if (options) {
    const filters = { ...defaultGiftFilters, ...options.filters };
    if (isOwner) filters.status = "all";
    // The common browse path needs only SQL aggregates and one page of cards.
    // Accent-insensitive search and locale-aware sorts retain the metadata path.
    if (
      !filters.query.trim() &&
      filters.status === "all" &&
      ["manual", "recent"].includes(filters.sort)
    ) {
      const where: Prisma.WishlistItemWhereInput = {
        wishlistId: id,
        deletedAt: null,
      };
      const groups = await db.wishlistItem.groupBy({
        by: ["currency"],
        where,
        _sum: { priceCents: true },
        _count: { _all: true, priceCents: true },
      });
      const currencies = new Set(
        groups
          .filter((group) => group._count.priceCents > 0)
          .map((group) => group.currency || "EUR"),
      );
      if (currencies.size > 1) filters.maxPrice = "";
      const filteredWhere: Prisma.WishlistItemWhereInput = { ...where };
      if (filters.priority !== "all") filteredWhere.priority = filters.priority;
      if (filters.maxPrice.trim()) {
        const max = Number(filters.maxPrice);
        if (!Number.isFinite(max) || max < 0) filteredWhere.id = { in: [] };
        else
          filteredWhere.priceCents = {
            lte: Math.min(Math.round(max * 100), 2147483647),
          };
      }
      const filtered =
        filters.priority === "all" && !filters.maxPrice.trim()
          ? groups
          : await db.wishlistItem.groupBy({
              by: ["currency"],
              where: filteredWhere,
              _sum: { priceCents: true },
              _count: { _all: true, priceCents: true },
            });
      const matched = filtered.reduce(
        (sum, group) => sum + group._count._all,
        0,
      );
      const pages = Math.max(1, Math.ceil(matched / 24));
      const requested = options.page ?? 1;
      const page = Math.min(
        pages,
        Math.max(1, Number.isFinite(requested) ? Math.trunc(requested) : 1),
      );
      const totals: Record<string, number> = {};
      for (const group of filtered) {
        if (!group._count.priceCents) continue;
        const currency = group.currency || "EUR";
        totals[currency] =
          (totals[currency] || 0) + (group._sum.priceCents || 0);
      }
      pagination = {
        page,
        pages,
        matched,
        filters,
        totals,
        total: groups.reduce((sum, group) => sum + group._count._all, 0),
        unpriced: filtered.reduce(
          (sum, group) => sum + group._count._all - group._count.priceCents,
          0,
        ),
        mixedCurrencies: currencies.size > 1,
        currency: currencies.values().next().value || "EUR",
      };
      pageWindow = { skip: (page - 1) * 24, take: 24 };
      pageOrder =
        filters.sort === "recent"
          ? [{ createdAt: "desc" }, { id: "asc" }]
          : [...manualGiftOrder];
      // Reuse these filters on the detail query without loading all item IDs.
      itemWhere = filteredWhere;
    }
  }
  if (options && !pagination) {
    // Search metadata stays on the server; full details/cards are fetched only for this page.
    const metadata = await db.wishlistItem.findMany({
      where: { wishlistId: id, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        position: true,
        title: true,
        description: true,
        size: true,
        color: true,
        model: true,
        priceCents: true,
        currency: true,
        priority: true,
        isGroupGift: true,
        ...signals,
      },
    });
    const gifts = metadata.map((item) => presentGift(item, isOwner, userId));
    const currencies = new Set(
      gifts
        .filter((gift) => gift.priceCents !== null)
        .map((gift) => gift.currency || "EUR"),
    );
    const filters = { ...defaultGiftFilters, ...options.filters };
    if (isOwner) filters.status = "all";
    if (currencies.size > 1) filters.maxPrice = "";
    const visible = selectGifts(
      gifts,
      filters,
      isOwner,
      options.locale || "fr",
    );
    const paged = paginateGifts(visible, options.page || 1);
    selectedIds = paged.items.map((gift) => gift.id);
    pagination = {
      page: paged.page,
      pages: paged.pages,
      total: gifts.length,
      matched: visible.length,
      filters,
      ...giftTotals(visible),
      mixedCurrencies: currencies.size > 1,
      currency: currencies.values().next().value || "EUR",
    };
  }
  const result = await db.wishlist.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      occasion: true,
      neededBy: true,
      preferences: true,
      ownerId: true,
      recipientId: true,
      recipient: { select: { name: true } },
      visibility: true,
      eventId: true,
      archivedAt: true,
      owner: { select: { name: true, profilePhoto: true } },
      event: { select: { name: true, date: true } },
      items: {
        where: {
          ...itemWhere,
          ...(selectedIds ? { id: { in: selectedIds } } : {}),
        },
        orderBy: pageOrder,
        ...pageWindow,
        ...(selectedIds ? { take: 24 } : {}),
        select: {
          id: true,
          position: true,
          title: true,
          description: true,
          url: true,
          alternativeUrls: true,
          priceCents: true,
          currency: true,
          priority: true,
          image: true,
          size: true,
          color: true,
          model: true,
          isGroupGift: true,
          ...signals,
        },
      },
    },
  });
  if (!result) return null;
  const itemOrder = new Map(orderedIds.map((id, index) => [id, index]));
  const items = result.items.map((item) => ({
    ...presentGift(item, isOwner, userId),
    ...(isOwner
      ? {
          canMoveUp: (itemOrder.get(item.id) ?? 0) > 0,
          canMoveDown: (itemOrder.get(item.id) ?? 0) < orderedIds.length - 1,
        }
      : {}),
  }));
  if (selectedIds) {
    const order = new Map(selectedIds.map((id, index) => [id, index]));
    items.sort((a, b) => (order.get(a.id) || 0) - (order.get(b.id) || 0));
  }
  return {
    ...result,
    isOwner,
    canEdit: isOwner && !list.archivedAt,
    pagination,
    items,
  };
}

function presentGift<
  T extends {
    isGroupGift: boolean;
    priceCents: number | null;
    reservations?: { userId: string | null }[];
    contributions?: { userId: string; amountCents: number }[];
  },
>(item: T, isOwner: boolean, userId?: string) {
  // Never send reservation records or identities to the presentation layer.
  const { reservations, contributions, ...gift } = item;
  const contributedCents = !isOwner
    ? contributions?.reduce((sum, c) => sum + c.amountCents, 0) || 0
    : 0;
  return {
    ...gift,
    contributedCents,
    myContributionCents: !isOwner
      ? contributions?.find((c) => c.userId === userId)?.amountCents || 0
      : 0,
    isReserved:
      !isOwner &&
      (item.isGroupGift
        ? !!item.priceCents && contributedCents >= item.priceCents
        : Boolean(reservations?.length)),
    reservedByMe:
      !isOwner &&
      (item.isGroupGift
        ? Boolean(contributions?.some((c) => c.userId === userId))
        : Boolean(reservations?.some((r) => r.userId === userId))),
  };
}

export async function reserveGift(
  db: PrismaClient,
  itemId: string,
  userId: string,
  token?: string,
  preparation?: {
    preparationStatus: string;
    quantity: number;
    personalMessage?: string;
    messageReleasedAt?: string;
  },
): Promise<ActionResult> {
  const item = await db.wishlistItem.findUnique({
    where: { id: itemId },
    include: { wishlist: true },
  });
  if (
    !item ||
    item.isGroupGift ||
    item.deletedAt ||
    item.wishlist.archivedAt ||
    item.wishlist.deletedAt ||
    item.wishlist.ownerId === userId ||
    !(await canReadWishlist(db, item.wishlist, userId, token))
  )
    return { error: "forbidden" };
  try {
    // The unique itemId constraint is the final guard against concurrent reservations.
    await db.reservation.create({
      data: {
        itemId,
        userId,
        quantity: preparation?.quantity || 1,
        preparationStatus: preparation?.preparationStatus || "RESERVED",
        personalMessage: preparation?.personalMessage || null,
        messageReleasedAt: preparation?.messageReleasedAt
          ? new Date(preparation.messageReleasedAt)
          : null,
        accessTokenHash:
          item.wishlist.visibility === "LINK" && token
            ? hashShareToken(token)
            : null,
      },
    });
    reportBusinessEvent("gift_reserved");
    return { success: true };
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "P2002"
    )
      return { error: "alreadyReserved" };
    throw error;
  }
}

export async function readMyReservations(db: PrismaClient, userId: string) {
  const familyOwners = createFamilyMembershipLoader(db, userId);
  const canRead = createReadAccessChecker((list, token) =>
    canReadWishlist(db, list, userId, token, familyOwners),
  );
  const reservations = await db.reservation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      item: {
        include: {
          wishlist: {
            include: {
              owner: { select: { name: true } },
              recipient: { select: { name: true } },
              event: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  return Promise.all(
    reservations.map(
      async ({
        item,
        accessTokenHash,
        quantity,
        preparationStatus,
        personalMessage,
      }) => {
        const list = item.wishlist;
        const token =
          list.visibility === "LINK" &&
          list.shareToken &&
          accessTokenHash === hashShareToken(list.shareToken)
            ? list.shareToken
            : undefined;
        if (item.deletedAt || !(await canRead(list, token)))
          return { itemId: item.id, gift: null };
        return {
          itemId: item.id,
          preparationStatus,
          personalMessage,
          gift: {
            quantity,
            occasion: list.occasion,
            title: item.title,
            description: item.description,
            image: item.image,
            size: item.size,
            color: item.color,
            model: item.model,
            priceCents: item.priceCents,
            currency: item.currency,
            recipient: list.recipient?.name || list.owner.name,
            event: list.event?.name,
            listName: list.name,
            href: token ? `/share/${token}` : `/dashboard/wishlists/${list.id}`,
            token,
          },
        };
      },
    ),
  );
}

export async function cancelGift(
  db: PrismaClient,
  itemId: string,
  userId: string,
): Promise<ActionResult> {
  const result = await db.reservation.deleteMany({ where: { itemId, userId } });
  return result.count ? { success: true } : { error: "forbidden" };
}
