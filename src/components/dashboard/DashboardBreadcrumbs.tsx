"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { dashboardBreadcrumbs } from "@/lib/dashboard-breadcrumbs";
import styles from "./DashboardBreadcrumbs.module.css";

export function DashboardBreadcrumbs() {
  const t = useTranslations("breadcrumbs");
  const crumbs = dashboardBreadcrumbs(usePathname());
  // Do not display breadcrumbs on root dashboard sections to avoid triple redundancy
  if (crumbs.length <= 2) return null;
  return (
    <nav aria-label={t("label")} className={styles.navigation}>
      <ol>
        {crumbs.map((crumb) => (
          <li key={crumb.key}>
            {crumb.href ? (
              <Link href={crumb.href}>{t(crumb.key)}</Link>
            ) : (
              <span aria-current="page">{t(crumb.key)}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
