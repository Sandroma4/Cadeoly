"use client";
import { useTranslations, useLocale } from "next-intl";
export function ItemPreview({
  preview,
  currency,
  isGroupGift,
}: {
  preview: Record<string, string>;
  currency: string;
  isGroupGift?: boolean;
}) {
  const t = useTranslations("wishlist");
  const flow = useTranslations("uiFlow");
  const locale = useLocale();
  return (
    <section
      className="gift-preview stack"
      aria-label={flow("preview")}
      role="status"
    >
      <h4>{flow("preview")}</h4>
      <strong>{preview.title}</strong>
      {preview.description && <p>{preview.description}</p>}
      {preview.price && (
        <p>
          {t("price")}:{" "}
          {new Intl.NumberFormat(locale, {
            style: "currency",
            currency,
          }).format(Number(preview.price))}
        </p>
      )}
      {preview.url && <p>{preview.url}</p>}
      <p>
        {t("priority")}:{" "}
        {t(
          "priority" +
            preview.priority[0] +
            preview.priority.slice(1).toLowerCase(),
        )}
      </p>
      {["size", "color", "model"].map((key) =>
        preview[key] ? (
          <p key={key}>
            {t(key)}: {preview[key]}
          </p>
        ) : null,
      )}
      {(isGroupGift || preview.isGroupGift === "on") && <p>{t("groupGift")}</p>}
      <p>{flow("previewHelp")}</p>
    </section>
  );
}
