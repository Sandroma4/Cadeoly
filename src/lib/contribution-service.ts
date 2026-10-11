import type { PrismaClient } from "@wishi/prisma-client";
import { canReadWishlist, hashShareToken } from "./wishlist-service";
import {
  createReadAccessChecker,
  createFamilyMembershipLoader,
} from "./read-access-checker";
export async function contributeGift(
  db: PrismaClient,
  itemId: string,
  userId: string,
  amountCents: number,
  token?: string,
) {
  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    amountCents > 999999999
  )
    return { error: "invalidFields" };
  try {
    return await db.$transaction(async (tx) => {
      const item = await tx.wishlistItem.findUnique({
        where: { id: itemId },
        include: { wishlist: true },
      });
      if (
        !item ||
        !item.isGroupGift ||
        !item.priceCents ||
        (item.currency && item.currency !== "EUR") ||
        item.deletedAt ||
        item.wishlist.deletedAt ||
        item.wishlist.archivedAt ||
        item.wishlist.ownerId === userId ||
        !(await canReadWishlist(
          tx as unknown as PrismaClient,
          item.wishlist,
          userId,
          token,
        ))
      )
        return { error: "forbidden" };
      const accessTokenHash =
        item.wishlist.visibility === "LINK" && token
          ? hashShareToken(token)
          : null;
      const total = await tx.contribution.aggregate({
        where: {
          itemId,
          userId: { not: userId },
          ...(item.wishlist.visibility === "LINK" ? { accessTokenHash } : {}),
        },
        _sum: { amountCents: true },
      });
      if ((total._sum.amountCents || 0) + amountCents > item.priceCents)
        return { error: "groupBudgetExceeded" };
      await tx.contribution.upsert({
        where: { itemId_userId: { itemId, userId } },
        create: { itemId, userId, amountCents, accessTokenHash },
        update: { amountCents, accessTokenHash },
      });
      return { success: true };
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      ["P2034", "P2028"].includes(String(error.code))
    )
      return { error: "unexpected" };
    throw error;
  }
}
export async function cancelContribution(
  db: PrismaClient,
  itemId: string,
  userId: string,
) {
  await db.contribution.deleteMany({ where: { itemId, userId } });
  return { success: true };
}
export async function readMyContributions(db: PrismaClient, userId: string) {
  const familyOwners = createFamilyMembershipLoader(db, userId);
  const canRead = createReadAccessChecker((list, token) =>
    canReadWishlist(db, list, userId, token, familyOwners),
  );
  const rows = await db.contribution.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { item: { include: { wishlist: true } } },
  });
  return Promise.all(
    rows.map(async (row) => {
      const list = row.item.wishlist;
      const token =
        list.visibility === "LINK" &&
        list.shareToken &&
        row.accessTokenHash === hashShareToken(list.shareToken)
          ? list.shareToken
          : undefined;
      const accessible = !row.item.deletedAt && (await canRead(list, token));
      return {
        itemId: row.itemId,
        amountCents: row.amountCents,
        currency: accessible ? row.item.currency : null,
        occasion: accessible ? list.occasion : null,
        title: accessible ? row.item.title : null,
        token: accessible ? token : undefined,
        href: accessible
          ? token
            ? `/share/${token}`
            : `/lists/${list.id}`
          : null,
      };
    }),
  );
}
