"use client";

import { useLocale, useTranslations } from "next-intl";

export function GiftFunding({
  total,
  target,
  currency = "EUR",
}: {
  total: number;
  target: number | null;
  currency?: string | null;
}) {
  const locale = useLocale();
  const t = useTranslations("contributions");
  if (!target || target <= 0) return null;
  const money = (cents: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency || "EUR",
    }).format(cents / 100);
  const label = t("progress", { total: money(total), target: money(target) });
  const percentage = Math.round((Math.max(0, Math.min(total, target)) / target) * 100);

  return (
    <div className="gift-funding">
      <div className="gift-funding-header">
        <span className="gift-funding-amount">{label}</span>
        <span className="gift-funding-percent">{percentage}%</span>
      </div>
      <div className="gift-progress-wrapper">
        <progress
          className="gift-progress"
          value={Math.max(0, Math.min(total, target))}
          max={target}
          aria-label={label}
        />
      </div>
      {total >= target && (
        <p className="visual-badge gift-funded">{t("complete")}</p>
      )}
    </div>
  );
}
