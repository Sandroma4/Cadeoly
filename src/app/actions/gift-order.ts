"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { refreshWishlists } from "@/lib/refresh";
import { moveGift } from "@/lib/gift-order-service";

export async function moveWishlistGift(id: string, direction: "up" | "down") {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  const result = await moveGift(prisma, id, session.user.id, direction);
  refreshWishlists();
  return result;
}
