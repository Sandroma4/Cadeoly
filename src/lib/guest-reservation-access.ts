import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { hashShareToken } from "./wishlist-service";
import { ownsGuestReservation } from "./guest-reservation-service";

export const guestCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 30 * 86400,
};
export const proofCookie = (id: string) => "cadeoly-reservation-" + id;
export async function guestReservationAccess(id: string) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return null;
  const row = await prisma.reservation.findUnique({
    where: { id },
    include: { item: { select: { title: true, wishlistId: true } } },
  });
  if (
    !row ||
    row.userId ||
    !row.managementExpiresAt ||
    row.managementExpiresAt <= new Date()
  )
    return null;
  const jar = await cookies();
  const proof = jar.get(proofCookie(id))?.value;
  const verified = Boolean(
    proof && hashShareToken(proof) === row.managementTokenHash,
  );
  const session = jar.get("cadeoly-guest")?.value;
  if (
    !verified &&
    !ownsGuestReservation(row, session ? hashShareToken(session) : undefined)
  )
    return null;
  return { row, verified };
}
