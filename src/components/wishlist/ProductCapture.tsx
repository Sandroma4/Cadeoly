"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { productBookmarklet } from "@/lib/product-capture";
import { Button } from "@/components/ui/Button";

export function ProductCapture() {
  const t = useTranslations("productImport");
  const locale = useLocale();
  const bookmark = useRef<HTMLAnchorElement>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    bookmark.current?.setAttribute(
      "href",
      productBookmarklet(`${window.location.origin}/${locale}/quick-add`),
    );
  }, [locale]);
  return (
    <details className="form-options list-detail-options">
      <summary>{t("captureTitle")}</summary>
      <div className="stack">
        <p>{t("captureHelp")}</p>
        <a
          href="#"
          ref={bookmark}
          className="secondary-link"
          draggable
          onClick={(event) => {
            event.preventDefault();
            setMessage(t("captureInstall"));
          }}
        >
          {t("captureBookmark")}
        </a>
        <p className="form-hint">{t("captureInstall")}</p>
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            const value = productBookmarklet(
              `${window.location.origin}/${locale}/quick-add`,
            );
            setCode(value);
            try {
              await navigator.clipboard.writeText(value);
              setMessage(t("captureCopied"));
            } catch {
              setMessage(t("captureCopyManually"));
            }
          }}
        >
          {t("captureCopy")}
        </Button>
        {code && (
          <label>
            {t("captureCode")}
            <textarea
              readOnly
              rows={3}
              value={code}
              onFocus={(event) => event.target.select()}
            />
          </label>
        )}
        {message && <p role="status">{message}</p>}
      </div>
    </details>
  );
}
