"use server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { withAuth } from "@/lib/action-auth";
import type { ActionResult } from "@/lib/action-result";
import { fields, itemSchema } from "@/lib/validation";
import { refreshWishlists } from "@/lib/refresh";
import { reserveGift, cancelGift } from "@/lib/wishlist-service";
import { saveGiftPhoto, removeGiftPhoto } from "@/lib/gift-photos";
import { canonicalGiftUrl } from "@/lib/duplicate-gifts";
import {
  changeGiftState,
  readTrashedGifts,
} from "@/lib/gift-lifecycle-service";
async function upload(form: FormData) {
  const file = form.get("photo");
  return file instanceof File && file.size ? saveGiftPhoto(file) : null;
}
export async function createWishlistItem(
  form: FormData,
): Promise<ActionResult> {
  return withAuth(async (userId): Promise<ActionResult> => {
    const parsed = itemSchema.safeParse(fields(form));
    const wishlistId = String(form.get("wishlistId") || "");
    if (!parsed.success)
      return {
        error: "invalidFields",
        fields: Object.keys(parsed.error.flatten().fieldErrors),
      };
    if (
      !(await prisma.wishlist.findFirst({
        where: {
          id: wishlistId,
          ownerId: userId,
          archivedAt: null,
          deletedAt: null,
        },
      }))
    )
      return { error: "forbidden" };
    const { price, ...data } = parsed.data;
    if (data.isGroupGift && (!price || price <= 0))
      return { error: "groupPriceRequired" };
    const canonical = canonicalGiftUrl(data.url);
    if (canonical && form.get("allowDuplicate") !== "on") {
      const existing = await prisma.wishlistItem.findMany({
        where: { wishlistId, deletedAt: null },
        select: { url: true },
      });
      if (existing.some((item) => canonicalGiftUrl(item.url) === canonical))
        return { error: "duplicateGift" };
    }
    let image: string | null = null;
    try {
      image = await upload(form);
    } catch {
      return { error: "invalidPhoto" };
    }
    try {
      await prisma.wishlistItem.create({
        data: { ...data, priceCents: price, wishlistId, image },
      });
    } catch (error) {
      await removeGiftPhoto(image);
      throw error;
    }
    refreshWishlists();
    return { success: true };
  });
}
export async function updateWishlistItem(
  id: string,
  form: FormData,
): Promise<ActionResult> {
  return withAuth(async (userId): Promise<ActionResult> => {
    const parsed = itemSchema.safeParse(fields(form));
    if (!parsed.success)
      return {
        error: "invalidFields",
        fields: Object.keys(parsed.error.flatten().fieldErrors),
      };
    const existing = await prisma.wishlistItem.findFirst({
      where: {
        id,
        deletedAt: null,
        wishlist: { ownerId: userId, archivedAt: null, deletedAt: null },
      },
      select: { image: true, isGroupGift: true, wishlistId: true },
    });
    if (!existing) return { error: "forbidden" };
    const canonical = canonicalGiftUrl(parsed.data.url);
    if (canonical && form.get("allowDuplicate") !== "on") {
      const others = await prisma.wishlistItem.findMany({
        where: {
          wishlistId: existing.wishlistId,
          id: { not: id },
          deletedAt: null,
        },
        select: { url: true },
      });
      if (others.some((item) => canonicalGiftUrl(item.url) === canonical))
        return { error: "duplicateGift" };
    }
    if (existing.isGroupGift && (!parsed.data.price || parsed.data.price <= 0))
      return { error: "groupPriceRequired" };
    let image: string | null = null;
    try {
      image = await upload(form);
    } catch {
      return { error: "invalidPhoto" };
    }
    const nextImage =
      image || (form.get("removePhoto") === "on" ? null : existing.image);
    const { price, ...data } = parsed.data;
    let result;
    try {
      result = await prisma.wishlistItem.updateMany({
        where: {
          id,
          deletedAt: null,
          wishlist: {
            ownerId: userId,
            archivedAt: null,
            deletedAt: null,
          },
        },
        data: {
          ...data,
          isGroupGift: existing.isGroupGift,
          priceCents: price,
          image: nextImage,
        },
      });
    } catch (error) {
      await removeGiftPhoto(image);
      throw error;
    }
    if (!result.count) {
      await removeGiftPhoto(image);
      return { error: "forbidden" };
    }
    if (nextImage !== existing.image) await removeGiftPhoto(existing.image);
    refreshWishlists();
    return { success: true };
  });
}
export async function deleteWishlistItem(id: string): Promise<ActionResult> {
  return setGiftState(id, false);
}
export async function restoreWishlistItem(id: string): Promise<ActionResult> {
  return setGiftState(id, true);
}
async function setGiftState(
  id: string,
  restore: boolean,
): Promise<ActionResult> {
  return withAuth(async (userId): Promise<ActionResult> => {
    const result = await changeGiftState(prisma, id, userId, restore);
    refreshWishlists();
    return result;
  });
}
export async function getTrashedGifts(wishlistId: string) {
  const session = await auth();
  return session?.user?.id
    ? readTrashedGifts(prisma, wishlistId, session.user.id)
    : [];
}
export async function reserveItem(
  id: string,
  token?: string,
): Promise<ActionResult> {
  return withAuth(async (userId): Promise<ActionResult> => {
    const result = await reserveGift(prisma, id, userId, token);
    refreshWishlists();
    return result;
  });
}
export async function cancelReservation(id: string): Promise<ActionResult> {
  return withAuth(async (userId): Promise<ActionResult> => {
    const result = await cancelGift(prisma, id, userId);
    refreshWishlists();
    return result;
  });
}
