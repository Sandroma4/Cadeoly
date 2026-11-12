"use client";
import { useId, type Ref } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

/** One field: a pasted link starts an import, anything else becomes the gift name. */
export function ItemModeChooser({
  chooserRef,
  onChoose,
  onCancel,
}: {
  chooserRef: Ref<HTMLDivElement>;
  onChoose: (mode: "link" | "manual", value?: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("wishlist");
  const flow = useTranslations("uiFlow");
  const c = useTranslations("common");
  const inputId = useId();
  return (
    <Card className="gift-editor">
      <CardContent>
        <div ref={chooserRef} className="gift-choice-panel">
          <h2>{t("addItem")}</h2>
          <form
            className="gift-quick-entry"
            onSubmit={(event) => {
              event.preventDefault();
              const value = String(
                new FormData(event.currentTarget).get("entry") || "",
              ).trim();
              if (!value) return;
              onChoose(/^https?:\/\/\S+$/i.test(value) ? "link" : "manual", value);
            }}
          >
            <label htmlFor={inputId}>{flow("quickEntryLabel")}</label>
            <div className="gift-quick-entry-row">
              <input
                id={inputId}
                name="entry"
                autoComplete="off"
                maxLength={2048}
                placeholder={flow("quickEntryPlaceholder")}
                required
              />
              <Button type="submit">{flow("quickEntryContinue")}</Button>
            </div>
            <p className="form-hint">{flow("quickEntryHelp")}</p>
          </form>
          <div
            className="gift-mode-shortcuts"
            role="group"
            aria-label={flow("chooseMode")}
          >
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChoose("link")}
            >
              {flow("fromLink")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChoose("manual")}
            >
              {flow("manual")}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              {c("cancel")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
