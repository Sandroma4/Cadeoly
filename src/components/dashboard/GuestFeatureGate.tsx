"use client";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
export function GuestFeatureGate({
  guestMode,
  children,
}: {
  guestMode: boolean;
  children: ReactNode;
}) {
  const path = usePathname(),
    locale = useLocale(),
    t = useTranslations("guestAccount"),
    auth = useTranslations("auth");
  const allowed =
    path === "/dashboard" ||
    /^\/dashboard\/wishlists(?:\/[A-Za-z0-9_-]+)?$/.test(path);
  if (!guestMode || allowed) return children;
  const next = "/" + locale + path;
  return (
    <section className="stack focused-page">
      <h1>{t("requiredTitle")}</h1>
      <p>{t("requiredDescription")}</p>
      <Link
        className="primary-link"
        href={{ pathname: "/register", query: { next } }}
      >
        {t("createAccount")}
      </Link>
      <Link
        className="secondary-link"
        href={{ pathname: "/login", query: { next } }}
      >
        {auth("signIn")}
      </Link>
    </section>
  );
}
