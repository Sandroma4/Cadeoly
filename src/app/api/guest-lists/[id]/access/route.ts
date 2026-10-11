import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  guestOwner,
  guestListCookie,
  guestListMaxAge,
} from "@/lib/guest-list-service";
import { guestCookieOptions } from "@/lib/guest-reservation-access";
import { reportBusinessEvent } from "@/lib/observability";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token") || "";
  const owner = await guestOwner(prisma, token);
  const list =
    owner && /^[A-Za-z0-9_-]{1,100}$/.test(id)
      ? await prisma.wishlist.findFirst({
          where: { id, ownerId: owner.id, deletedAt: null, archivedAt: null },
          select: { id: true },
        })
      : null;
  const securityHeaders = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
  };
  if (!list)
    return new NextResponse(
      "Lien invalide ou expiré / Invalid or expired link",
      { status: 404, headers: securityHeaders },
    );
  const locale =
    request.nextUrl.searchParams.get("locale") === "en" ? "en" : "fr";
  const response = NextResponse.redirect(
    new URL(
      `/${locale}/guest/lists/${list.id}`,
      process.env.AUTH_URL || request.url,
    ),
  );
  for (const [key, value] of Object.entries(securityHeaders))
    response.headers.set(key, value);
  response.cookies.set(guestListCookie, token, {
    ...guestCookieOptions,
    maxAge: guestListMaxAge,
  });
  reportBusinessEvent("guest_list_recovered");
  return response;
}
