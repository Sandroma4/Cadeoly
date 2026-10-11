"use client";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import type { Gift } from "./gift-editor-types";
export function ItemActions({
  item,
  pending,
  success,
  error,
  onOpen,
  onRemove,
}: {
  item?: Gift;
  pending: boolean;
  success: string;
  error: string;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const c = useTranslations("common");
  const flow = useTranslations("uiFlow");
  const t = useTranslations("wishlist");
  const trash = useTranslations("giftTrash");
  return (
    <div className="stack">
      <div className="button-row">
        <Button disabled={pending} onClick={onOpen}>
          {item ? c("edit") : success ? flow("addAnother") : t("addItem")}
        </Button>
        {item && (
          <Button
            disabled={pending}
            variant="ghost"
            className="gift-remove"
            onClick={onRemove}
          >
            {trash("move")}
          </Button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {success && (
        <>
          <p role="status">{success}</p>
          <a className="secondary-link" href="#list-gifts">
            {flow("viewMyList")}
          </a>
        </>
      )}
    </div>
  );
}
