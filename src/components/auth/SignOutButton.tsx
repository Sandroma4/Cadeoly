"use client";
import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { clearDrafts } from "@/components/ui/DraftScope";
export function SignOutButton() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  return (
    <Button
      variant="ghost"
      onClick={() => {
        clearDrafts();
        return signOut({ callbackUrl: "/" + locale + "/login" });
      }}
    >
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
      </svg>
      <span>{t("signOut")}</span>
    </Button>
  );
}
