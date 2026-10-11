export type DashboardBreadcrumb = { key: string; href?: string };

const sections = [
  "wishlists",
  "events",
  "family",
  "reservations",
  "feedback",
  "profile",
  "gift-ideas",
  "search",
] as const;

export function dashboardBreadcrumbs(pathname: string): DashboardBreadcrumb[] {
  const path = pathname.split(/[?#]/)[0].replace(/\/$/, "");
  const segments = path.split("/").filter(Boolean);
  if (segments[0] !== "dashboard" || segments.length < 2) return [];
  const section = sections.find((value) => value === segments[1]);
  if (!section) return [];
  const crumbs: DashboardBreadcrumb[] = [{ key: "home", href: "/dashboard" }];
  const detail = segments.length > 2;
  crumbs.push({
    key: section,
    ...(detail ? { href: `/dashboard/${section}` } : {}),
  });
  if (detail) {
    crumbs.push({
      key:
        section === "wishlists"
          ? segments[2] === "create"
            ? "createWishlist"
            : "wishlistDetails"
          : section === "events"
            ? "eventDetails"
            : "details",
    });
  }
  return crumbs;
}
