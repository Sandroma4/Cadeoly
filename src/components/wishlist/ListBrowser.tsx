"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
export function ListBrowser({
  lists,
  filters,
}: {
  filters?: ReactNode;
  lists: {
    id: string;
    name: string;
    description: string | null;
    card: ReactNode;
  }[];
}) {
  const searchId = useId();
  const t = useTranslations("listNavigation");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const visible = lists.filter((list) =>
    normalize(list.name + " " + (list.description || "")).includes(
      normalize(query.trim()),
    ),
  );
  return (
    <div className="stack list-browser">
      <div className="list-toolbar">
        {filters}
        <button
          type="button"
          className="list-search-toggle"
          aria-label={t("search")}
          aria-expanded={searchOpen}
          aria-controls={`${searchId}-panel`}
          onClick={() => {
            if (searchOpen) setQuery("");
            setSearchOpen(!searchOpen);
          }}
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
        </button>
        <div
          id={`${searchId}-panel`}
          className={`list-search${searchOpen ? " list-search-open" : ""}`}
        >
          <div className="list-search-field">
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              ref={searchInput}
              id={searchId}
              type="search"
              aria-label={t("search")}
              placeholder={t("search") + "…"}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              maxLength={120}
            />
          </div>
        </div>
      </div>
      <p className="result-count" role="status">
        {t("shown", { count: visible.length, total: lists.length })}
      </p>
      <div className="wishlist-browser-grid">
        {visible.map((list) => (
          <div key={list.id}>{list.card}</div>
        ))}
      </div>
      {!visible.length && <p>{t("noResults")}</p>}
    </div>
  );
}
