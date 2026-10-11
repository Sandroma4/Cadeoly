"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { moveWishlistGift } from "@/app/actions/gift-order";
import styles from "./GiftOrderControls.module.css";

export function GiftOrderControls({
  itemId,
  title,
  canMoveUp,
  canMoveDown,
}: {
  itemId: string;
  title: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const t = useTranslations("wishlist"),
    errors = useTranslations("errors");
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState("");

  async function move(direction: "up" | "down") {
    setPending(true);
    setMessage("");
    try {
      const result = await moveWishlistGift(itemId, direction);
      if (result.error) setMessage(errors(result.error));
      else router.refresh();
    } catch {
      setMessage(errors("unexpected"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`stack ${styles.container}`}>
      <div
        className={styles.orderControls}
        role="group"
        aria-label={t("giftOrder", { title })}
      >
        <span className={styles.gripIcon} aria-hidden="true" title="Ordre">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="9" cy="6" r="1.5" />
            <circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" />
            <circle cx="15" cy="18" r="1.5" />
          </svg>
        </span>
        <button
          type="button"
          className={styles.orderButton}
          disabled={pending || !canMoveUp}
          onClick={() => move("up")}
          aria-label={t("moveGiftUp", { title })}
        >
          <span className={styles.arrowIcon} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m18 15-6-6-6 6" />
            </svg>
          </span>
          <span>{t("moveUp")}</span>
        </button>
        <button
          type="button"
          className={styles.orderButton}
          disabled={pending || !canMoveDown}
          onClick={() => move("down")}
          aria-label={t("moveGiftDown", { title })}
        >
          <span className={styles.arrowIcon} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
          <span>{t("moveDown")}</span>
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
