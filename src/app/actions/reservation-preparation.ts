"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { refreshWishlists } from "@/lib/refresh";
import {
  cancelWithUndo,
  undoCancellation,
  updatePreparation,
  type ReservationUndo,
} from "@/lib/reservation-preparation";
export async function setReservationPreparation(
  itemId: string,
  status: string,
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  const result = await updatePreparation(
    prisma,
    itemId,
    session.user.id,
    status,
  );
  refreshWishlists();
  return result;
}
export async function saveReservationNote(itemId: string, message: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  if (typeof message !== "string" || message.trim().length > 1000)
    return { error: "invalidFields" };
  const result = await prisma.reservation.updateMany({
    where: { itemId, userId: session.user.id },
    data: { personalMessage: message.trim() || null },
  });
  refreshWishlists();
  return result.count ? { success: true } : { error: "forbidden" };
}
export async function cancelReservationWithUndo(itemId: string): Promise<{
  error?: string;
  success?: boolean;
  undo?: ReservationUndo;
}> {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  const result = await cancelWithUndo(prisma, itemId, session.user.id);
  refreshWishlists();
  return result;
}
export async function restoreReservation(
  itemId: string,
  undo: ReservationUndo,
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  const result = await undoCancellation(prisma, itemId, session.user.id, undo);
  refreshWishlists();
  return result;
}
