"use client";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/Input";
import type { Gift } from "./gift-editor-types";
import { Priority } from "@/lib/domain-values";
export function ItemFormFields({
  item,
  initialTitle,
  initialPrice = "",
  fieldErrors,
}: {
  item?: Gift;
  initialTitle: string;
  initialPrice?: string;
  fieldErrors: string[];
}) {
  const t = useTranslations("wishlist");
  const flow = useTranslations("uiFlow");
  const prefix = item?.id || "new";
  const currency = item?.currency || "EUR";
  const fieldError = (name: string) =>
    fieldErrors.includes(name) ? flow("checkField") : undefined;
  return (
    <>
      {" "}
      <Input
        id={prefix + "-title"}
        name="title"
        error={fieldError("title")}
        label={flow("requiredName")}
        defaultValue={item?.title || initialTitle}
        maxLength={120}
        required
      />
      <div className="gift-main-fields">
        <Input
          id={prefix + "-price"}
          name="price"
          error={fieldError("price")}
          type="number"
          min="0"
          max="9999999.99"
          step="0.01"
          label={flow("estimatedPrice", { currency })}
          placeholder="29.90"
          defaultValue={
            item?.priceCents == null
              ? initialPrice
              : (item.priceCents / 100).toFixed(2)
          }
        />
        <div className="gift-priority">
          <label htmlFor={prefix + "-priority"}>{t("priority")}</label>
          <select
            name="priority"
            id={prefix + "-priority"}
            defaultValue={item?.priority || "NORMAL"}
          >
            {Object.values(Priority).map((value) => (
              <option key={value} value={value}>
                {t("priority" + value[0] + value.slice(1).toLowerCase())}
              </option>
            ))}
          </select>
        </div>
      </div>
      <details className="form-options list-detail-options">
        <summary>{flow("optionalDetails")}</summary>
        <div className="stack">
          <label htmlFor={prefix + "-alternatives"}>
            {t("alternativeUrls")}
          </label>
          <textarea
            id={prefix + "-alternatives"}
            name="alternativeUrls"
            rows={3}
            maxLength={10240}
            defaultValue={item?.alternativeUrls || ""}
            aria-invalid={fieldErrors.includes("alternativeUrls")}
            aria-describedby={prefix + "-alternatives-help"}
          />
          <p id={prefix + "-alternatives-help"}>
            {fieldError("alternativeUrls") || t("alternativeHelp")}
          </p>
          <Input
            id={prefix + "-description"}
            name="description"
            error={fieldError("description")}
            label={t("descriptionGift")}
            defaultValue={item?.description || ""}
            maxLength={2000}
          />
          {!item ? (
            <label>
              <input type="checkbox" name="isGroupGift" /> {t("groupGift")}
            </label>
          ) : (
            item.isGroupGift && <p>{t("groupGift")}</p>
          )}
          {!item && <p>{t("groupHint")}</p>}
          {(["size", "color", "model"] as const).map((key) => (
            <Input
              key={key}
              id={prefix + "-" + key}
              name={key}
              error={fieldError(key)}
              label={t(key)}
              maxLength={80}
              defaultValue={item?.[key] || ""}
            />
          ))}
        </div>
      </details>
    </>
  );
}
