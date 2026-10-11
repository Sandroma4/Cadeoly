import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { contentSecurityPolicy } from "./lib/security-headers";

const localize = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce);
  const response = localize(request);
  response.headers.set("Content-Security-Policy", policy);
  if (
    /\/(share|lists)\/|\/guest\/reservations\//.test(request.nextUrl.pathname)
  ) {
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "private, no-store");
  }
  // Set a request header (never trust a client-supplied destination), preserving
  // the locale and other request headers already forwarded by next-intl.
  const forwarded = new Set(
    response.headers
      .get("x-middleware-override-headers")
      ?.split(",")
      .filter(Boolean),
  );
  forwarded.add("x-cadeoly-return-path");
  forwarded.add("content-security-policy");
  forwarded.add("x-nonce");
  response.headers.set(
    "x-middleware-override-headers",
    [...forwarded].join(","),
  );
  response.headers.set(
    "x-middleware-request-x-cadeoly-return-path",
    request.nextUrl.pathname + request.nextUrl.search,
  );
  response.headers.set("x-middleware-request-content-security-policy", policy);
  response.headers.set("x-middleware-request-x-nonce", nonce);
  return response;
}

export const config = {
  matcher: ["/", "/(fr|en)/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
