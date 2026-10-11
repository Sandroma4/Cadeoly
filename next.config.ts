import createNextIntlPlugin from "next-intl/plugin";
import { networkInterfaces } from "node:os";
import { contentSecurityPolicy } from "./src/lib/security-headers";

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false as const,
  distDir: process.env.CADEOLY_E2E === "true" ? ".next-e2e" : ".next",
  allowedDevOrigins: [
    "127.0.0.1",
    ...Object.values(networkInterfaces())
      .flatMap((addresses) => addresses ?? [])
      .filter((address) => address.family === "IPv4" && !address.internal)
      .map((address) => address.address),
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains",
                },
              ]
            : []),
        ],
      },
      {
        source: "/api/guest-lists/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
  serverExternalPackages: ["@wishi/prisma-client"],
  turbopack: { root: process.cwd() },
  experimental: { serverActions: { bodySizeLimit: "6mb" as const } },
};

export default withNextIntl(nextConfig);
