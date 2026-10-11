"use client";

import { useState, useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import styles from "./ReservationsFilterView.module.css";

export type ReservationCardItem = {
  itemId: string;
  recipient: string;
  title: string;
  event?: string | null;
  card: ReactNode;
};

export function ReservationsFilterView({
  items,
}: {
  items: ReservationCardItem[];
}) {
  const t = useTranslations("reservations");
  const [selectedRecipient, setSelectedRecipient] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const recipients = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const name = item.recipient || t("unknown");
      map.set(name, (map.get(name) || 0) + 1);
    }
    return Array.from(map.entries());
  }, [items, t]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const recipientName = item.recipient || t("unknown");
      if (selectedRecipient !== "all" && recipientName !== selectedRecipient) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesRecipient = recipientName.toLowerCase().includes(query);
        const matchesEvent = item.event?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesRecipient && !matchesEvent) return false;
      }
      return true;
    });
  }, [items, selectedRecipient, searchQuery, t]);

  const showControls = items.length > 1 || recipients.length > 1;

  return (
    <div className={styles.container}>
      {showControls && (
        <div className={styles.controls}>
          {items.length > 3 && (
            <div className={styles.searchField}>
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                placeholder={t("filterByRecipient")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {recipients.length > 1 && (
            <div
              className={styles.pillsRow}
              role="group"
              aria-label={t("filterByRecipient")}
            >
              <button
                type="button"
                className={`${styles.filterPill} ${selectedRecipient === "all" ? styles.filterPillActive : ""}`}
                onClick={() => setSelectedRecipient("all")}
              >
                <span>{t("allRecipients")}</span>
                <span className={styles.countBadge}>{items.length}</span>
              </button>

              {recipients.map(([name, count]) => (
                <button
                  key={name}
                  type="button"
                  className={`${styles.filterPill} ${selectedRecipient === name ? styles.filterPillActive : ""}`}
                  onClick={() => setSelectedRecipient(name)}
                >
                  <span>{name}</span>
                  <span className={styles.countBadge}>{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className={styles.emptyFilter}>
          <p>{t("noMatch")}</p>
        </div>
      ) : (
        <div className="gift-grid">
          {filtered.map((item) => (
            <div key={item.itemId}>{item.card}</div>
          ))}
        </div>
      )}
    </div>
  );
}
