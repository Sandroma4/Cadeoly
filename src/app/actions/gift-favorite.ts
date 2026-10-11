"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { setGiftFavorite } from "@/lib/gift-favorites";
import { revalidatePath } from "next/cache";

export async function saveGiftFavorite(itemId: string, favorite: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  if (typeof itemId !== "string" || !itemId || typeof favorite !== "boolean")
    return { error: "invalidFields" };
  const result = await setGiftFavorite(
    prisma,
    itemId,
    session.user.id,
    favorite,
  );
  revalidatePath("/[locale]/dashboard/gift-ideas", "page");
  return result;
}
