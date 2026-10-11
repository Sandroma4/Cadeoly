"use client";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import styles from "@/app/[locale]/dashboard/layout.module.css";
const iconPaths = {
  home: "M3 10 12 3l9 7M5 9v12h14V9M9 21v-7h6v7",
  gift: "M3 8h18v4H3ZM5 12v9h14v-9M12 8v13M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z",
  bag: "M5 7h14l1 14H4L5 7ZM8 8V6a4 4 0 0 1 8 0v2",
  people:
    "M12 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM3 21v-2a6 6 0 0 1 12 0v2m1-16a3 3 0 0 1 0 6m3 10v-2a6 6 0 0 0-3-5",
  calendar:
    "M6 5h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3ZM7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2",
  mail: "M3 5h18v14H3ZM3 5l9 7 9-7",
  sparkles:
    "m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z",
};
const destinations = [
  ["/dashboard", "navHome", "home"],
  ["/dashboard/wishlists", "myWishlists", "gift"],
  ["/dashboard/gift-ideas", "navGiftIdeas", "sparkles"],
  ["/dashboard/reservations", "myReservations", "bag"],
  ["/dashboard/family", "navFamily", "people"],
  ["/dashboard/events", "navEvents", "calendar"],
  ["/dashboard/feedback", "navFeedback", "mail"],
] as const;
export function DashboardNavigation() {
  const path = usePathname(),
    t = useTranslations("dashboard");
  return (
    <nav className={styles.nav} aria-label={t("title")}>
      {destinations.map(([href, key, icon]) => {
        const active =
          href === "/dashboard"
            ? path === href
            : path === href || path.startsWith(href + "/");
        const isAuxiliary =
          href === "/dashboard/feedback" || href === "/dashboard/gift-ideas";
        return (
          <Link
            key={href}
            href={href}
            prefetch={true}
            className={`${styles.navItem} ${isAuxiliary ? styles.mobileAuxiliary : ""} ${href === "/dashboard/feedback" ? styles.supportLink : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={iconPaths[icon]} />
              </svg>
            </span>
            <span className={styles.navLabel}>{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
