import type {
  PrismaClient,
  Prisma,
  Wishlist,
  WishlistItem,
} from "@wishi/prisma-client";
import { z } from "zod";
import { copyGiftPhoto, removeGiftPhoto } from "./gift-photos";
import { manualGiftOrder } from "./gift-order-service";
import type { ActionResult } from "./action-result";

export async function changeListState(
  db: PrismaClient,
  id: string,
  ownerId: string,
  operation: "archive" | "trash" | "restore",
): Promise<ActionResult> {
  const result = await db.wishlist.updateMany({
    where: {
      id,
      ownerId,
      ...(operation === "restore"
        ? { OR: [{ archivedAt: { not: null } }, { deletedAt: { not: null } }] }
        : { deletedAt: null }),
    },
    data:
      operation === "restore"
        ? {
            archivedAt: null,
            deletedAt: null,
            visibility: "PRIVATE",
            shareToken: null,
          }
        : operation === "archive"
          ? { archivedAt: new Date(), shareToken: null }
          : { deletedAt: new Date(), shareToken: null },
  });
  return result.count ? { success: true } : { error: "forbidden" };
}

export async function duplicateList(
  db: PrismaClient,
  id: string,
  ownerId: string,
  name: string,
): Promise<ActionResult<{ wishlistId: string }>> {
  const parsed = z.string().trim().min(1).max(120).safeParse(name);
  if (!parsed.success) return { error: "invalidFields" };
  const source = await db.wishlist.findFirst({
    where: { id, ownerId, deletedAt: null },
    include: {
      items: { where: { deletedAt: null }, orderBy: [...manualGiftOrder] },
    },
  });
  if (!source) return { error: "forbidden" };
  const photos: string[] = [];
  try {
    const data = await prepareListCopy(source, photos);
    const copy = await db.$transaction(async (tx) => {
      // Recheck ownership and lifecycle after copying photos; never copy reservations.
      if (
        !(await tx.wishlist.findFirst({
          where: { id, ownerId, deletedAt: null },
        }))
      )
        throw new Error("sourceUnavailable");
      return tx.wishlist.create({
        data: {
          name: parsed.data,
          ...data,
          ownerId,
        },
      });
    });
    return { success: true, wishlistId: copy.id };
  } catch {
    await Promise.all(photos.map(removeGiftPhoto));
    return { error: "unexpected" };
  }
}

export async function prepareListCopy(
  source: Wishlist & { items: WishlistItem[] },
  photos: string[],
) {
  const items: Prisma.WishlistItemCreateWithoutWishlistInput[] = [];
  for (const [position, item] of source.items.entries()) {
    const image = await copyGiftPhoto(item.image);
    if (image) photos.push(image);
    items.push({
      position,
      title: item.title,
      description: item.description,
      url: item.url,
      alternativeUrls: item.alternativeUrls,
      priceCents: item.priceCents,
      currency: item.currency,
      priority: item.priority,
      size: item.size,
      color: item.color,
      model: item.model,
      isGroupGift: item.isGroupGift,
      image,
    });
  }
  return {
    description: source.description,
    occasion: source.occasion,
    neededBy: source.neededBy,
    preferences: source.preferences,
    recipientId: source.recipientId,
    visibility: "PRIVATE",
    items: { create: items },
  };
}
