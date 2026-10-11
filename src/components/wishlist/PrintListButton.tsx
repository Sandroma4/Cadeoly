"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

export function PrintListButton() {
  const t = useTranslations("wishlist");

  return (
    <Button
      type="button"
      variant="ghost"
      className="print-list-btn"
      onClick={() => window.print()}
      title={t("printList")}
      aria-label={t("printList")}
    >
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <path d="M6 14h12v8H6z" />
      </svg>
      <span>{t("printList")}</span>
    </Button>
  );
}
