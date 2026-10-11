"use client";
import type { Ref } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
export function ItemModeChooser({
  chooserRef,
  onChoose,
  onCancel,
}: {
  chooserRef: Ref<HTMLDivElement>;
  onChoose: (mode: "link" | "manual") => void;
  onCancel: () => void;
}) {
  const t = useTranslations("wishlist");
  const flow = useTranslations("uiFlow");
  const c = useTranslations("common");
  return (
    <Card className="gift-editor">
      <CardContent>
        <div ref={chooserRef} className="gift-choice-panel">
          <h2>{t("addItem")}</h2>
          <p>{flow("chooseMode")}</p>
          <div className="gift-mode-choices">
            <button
              type="button"
              className="gift-mode-choice"
              onClick={() => onChoose("link")}
            >
              <svg
                aria-hidden="true"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              >
                <path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" />
              </svg>
              <strong>{flow("fromLink")}</strong>
              <span>{flow("linkModeHelp")}</span>
            </button>
            <button
              type="button"
              className="gift-mode-choice"
              onClick={() => onChoose("manual")}
            >
              <svg
                aria-hidden="true"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 4 5 5-11 11-6 1 1-6L15 4Zm-2 2 5 5" />
              </svg>
              <strong>{flow("manual")}</strong>
              <span>{flow("manualModeHelp")}</span>
            </button>
          </div>
          <Button variant="ghost" onClick={onCancel}>
            {c("cancel")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
