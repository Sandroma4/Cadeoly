"use server";
import { listOwnerId } from "@/lib/action-auth";
import { prisma } from "@/lib/prisma";
import { refreshWishlists } from "@/lib/refresh";
import { moveGift } from "@/lib/gift-order-service";

export async function moveWishlistGift(id: string, direction: "up" | "down") {
  const userId = await listOwnerId();
  if (!userId) return { error: "unauthorized" };
  const result = await moveGift(prisma, id, userId, direction);
  refreshWishlists();
  return result;
}
