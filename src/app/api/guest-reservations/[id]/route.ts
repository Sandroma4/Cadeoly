import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashShareToken } from "@/lib/wishlist-service";
import {
  guestCookieOptions,
  proofCookie,
} from "@/lib/guest-reservation-access";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token") || "";
  const locale =
    request.nextUrl.searchParams.get("locale") === "en" ? "en" : "fr";
  const row =
    /^[A-Za-z0-9_-]{1,100}$/.test(id) && /^[A-Za-z0-9_-]{43}$/.test(token)
      ? await prisma.reservation.findFirst({
          where: {
            id,
            userId: null,
            managementTokenHash: hashShareToken(token),
            managementExpiresAt: { gt: new Date() },
          },
          select: { id: true },
        })
      : null;
  if (!row)
    return new NextResponse(
      "Lien invalide ou expiré / Invalid or expired link",
      {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  const response = NextResponse.redirect(
    new URL(
      `/${locale}/guest/reservations/${id}`,
      process.env.AUTH_URL || request.url,
    ),
  );
  response.cookies.set(proofCookie(id), token, guestCookieOptions);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
