"use client";
import { Priority } from "@/lib/domain-values";
import {
  useId,
  useState,
  useOptimistic,
  useTransition,
  useRef,
  useEffect,
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  selectGifts,
  defaultGiftFilters,
  giftTotals,
  type SearchableGift,
  type GiftFilters,
  type GiftPagination,
} from "@/lib/gift-search";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { paginateGifts } from "@/lib/gift-search";
import {
  readGiftView,
  subscribeGiftView,
  setGiftView,
  serverGiftView,
} from "@/lib/gift-view";
const initial = defaultGiftFilters;
export function GiftBrowser({
  gifts,
  owner,
  pagination,
  filtersContent,
  ideas,
}: {
  gifts: (SearchableGift & { card: ReactNode })[];
  owner: boolean;
  pagination?: GiftPagination;
  filtersContent?: ReactNode;
  ideas?: { total: number; reset: () => void; empty: ReactNode };
}) {
  const t = useTranslations("giftSearch");
  const p = useTranslations("improvements");
  const [page, setPage] = useState(1);
  const flow = useTranslations("uiFlow");
  const w = useTranslations("wishlist");
  const viewText = useTranslations("giftView");
  const view = useSyncExternalStore(
    subscribeGiftView,
    readGiftView,
    serverGiftView,
  );
  const locale = useLocale();
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localFilters, setFilters] = useState(initial);
  const [filters, setOptimisticFilters] = useOptimistic(
    pagination?.filters || localFilters,
  );
  const navigationVersion = useRef(0);
  useEffect(
    () => () => {
      navigationVersion.current++;
    },
    [],
  );
  const navigate = useCallback(
    (next: GiftFilters, page = 1, delay = 0) => {
      const version = ++navigationVersion.current;
      startTransition(async () => {
        setOptimisticFilters(next);
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        if (version !== navigationVersion.current) return;
        const url = new URL(window.location.href);
        for (const [key, value] of Object.entries({
          q: next.query,
          maxPrice: next.maxPrice,
          priority: next.priority,
          status: next.status,
          sort: next.sort,
        })) {
          const isDefault =
            ((key === "priority" || key === "status") && value === "all") ||
            (key === "sort" && value === initial.sort);
          if (value && !isDefault) url.searchParams.set(key, value);
          else url.searchParams.delete(key);
        }
        if (page > 1) url.searchParams.set("page", String(page));
        else url.searchParams.delete("page");
        startTransition(() => {
          router.replace(url.pathname + url.search + url.hash, {
            scroll: false,
          });
        });
      });
    },
    [router, setOptimisticFilters],
  );
  const change = useCallback(
    (key: keyof GiftFilters, value: string) => {
      if (pagination) {
        navigate({ ...filters, [key]: value }, 1, key === "query" ? 300 : 0);
        return;
      }
      setPage(1);
      setFilters((current) => ({ ...current, [key]: value }));
    },
    [filters, navigate, pagination],
  );
  const mixedCurrencies =
    pagination?.mixedCurrencies ??
    new Set(
      gifts
        .filter((gift) => gift.priceCents !== null)
        .map((gift) => gift.currency || "EUR"),
    ).size > 1;
  const visible = pagination
    ? gifts
    : selectGifts(
        gifts,
        mixedCurrencies ? { ...filters, maxPrice: "" } : filters,
        owner,
        locale,
      );
  const { totals, unpriced } = pagination || giftTotals(visible);
  const paged = pagination
    ? { items: gifts, page: pagination.page, pages: pagination.pages }
    : paginateGifts(visible, page);
  const viewControls = (
    <div
      className={`button-row gift-view-controls${ideas ? " gift-ideas-view-controls" : ""}`}
      role="group"
      aria-label={viewText("label")}
    >
      {(["photos", "compact"] as const).map((mode) => (
        <Button
          key={mode}
          variant="secondary"
          aria-pressed={view === mode}
          onClick={() => setGiftView(mode)}
        >
          {viewText(mode)}
        </Button>
      ))}
    </div>
  );
  return (
    <div className="stack gift-browser" aria-busy={pending}>
      {!ideas && viewControls}
      {!ideas && (
        <div className="gift-summary">
          <p>
            {t("total")}:{" "}
            {Object.entries(totals)
              .map(([currency, cents]) =>
                new Intl.NumberFormat(locale, {
                  style: "currency",
                  currency,
                }).format(cents / 100),
              )
              .join(" + ") || "—"}
          </p>
          {unpriced > 0 && <p>{t("unpriced", { count: unpriced })}</p>}
          {mixedCurrencies && <p>{t("currencies")}</p>}
        </div>
      )}

      <div className="gift-filters" role="search" aria-label={t("title")}>
        <div className="list-search gift-search">
          <label htmlFor={id + "-search"}>{t("search")}</label>
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
              id={id + "-search"}
              type="search"
              value={filters.query}
              onChange={(e) => change("query", e.target.value)}
              maxLength={120}
            />
          </div>
        </div>
      </div>
      {filtersContent}
      {!ideas && (
        <div
          className="button-row quick-budget-filters"
          role="group"
          aria-label={w("quickBudget")}
        >
          {!mixedCurrencies &&
            [
              { label: w("allBudgets"), value: "" },
              { label: "< 25 €", value: "25" },
              { label: "< 50 €", value: "50" },
              { label: "< 100 €", value: "100" },
            ].map((pill) => (
              <Button
                key={pill.value}
                type="button"
                variant={
                  filters.maxPrice === pill.value ? "primary" : "secondary"
                }
                className="budget-pill"
                value={pill.value}
                onClick={(event) =>
                  change("maxPrice", event.currentTarget.value)
                }
              >
                {pill.label}
              </Button>
            ))}
          <Button
            type="button"
            variant={filters.priority === "ESSENTIAL" ? "primary" : "secondary"}
            className="budget-pill"
            aria-pressed={filters.priority === "ESSENTIAL"}
            onClick={() =>
              change(
                "priority",
                filters.priority === "ESSENTIAL" ? "all" : "ESSENTIAL",
              )
            }
          >
            {t(ideas ? "quickPriority" : "quickEssential")}
          </Button>
          {!owner && (
            <Button
              type="button"
              variant={filters.status === "available" ? "primary" : "secondary"}
              className="budget-pill"
              aria-pressed={filters.status === "available"}
              onClick={() =>
                change(
                  "status",
                  filters.status === "available" ? "all" : "available",
                )
              }
            >
              {t("available")}
            </Button>
          )}
        </div>
      )}
      <details className="form-options list-detail-options gift-filter-panel">
        <summary>
          {flow("sortAndFilters")}{" "}
          {(filters.maxPrice ||
            filters.priority !== "all" ||
            filters.status !== "all" ||
            filters.sort !== initial.sort) && (
            <span>· {flow("filtersActive")}</span>
          )}
        </summary>
        <div className="gift-filters">
          <div className="stack">
            <label htmlFor={id + "-sort"}>{t("sort")}</label>
            <select
              id={id + "-sort"}
              value={filters.sort}
              onChange={(e) => change("sort", e.target.value)}
            >
              {[
                "manual",
                "recent",
                "priority",
                "priceAsc",
                "priceDesc",
                "name",
              ].map((value) => (
                <option key={value} value={value}>
                  {t(value)}
                </option>
              ))}
            </select>
          </div>
          {!ideas && !mixedCurrencies && (
            <Input
              id={id + "-budget"}
              label={t("budget", {
                currency:
                  pagination?.currency ||
                  gifts.find((gift) => gift.priceCents !== null)?.currency ||
                  "EUR",
              })}
              type="number"
              min="0"
              step="0.01"
              value={filters.maxPrice}
              onChange={(e) => change("maxPrice", e.target.value)}
            />
          )}
          <div className="stack">
            <label htmlFor={id + "-priority"}>{w("priority")}</label>
            <select
              id={id + "-priority"}
              value={filters.priority}
              onChange={(e) => change("priority", e.target.value)}
            >
              <option value="all">{t("allPriorities")}</option>
              {Object.values(Priority).map((value) => (
                <option key={value} value={value}>
                  {ideas && value === "ESSENTIAL"
                    ? t("quickPriority")
                    : w("priority" + value[0] + value.slice(1).toLowerCase())}
                </option>
              ))}
            </select>
          </div>
          {!owner && (
            <div className="stack">
              <label htmlFor={id + "-status"}>{t("status")}</label>
              <select
                id={id + "-status"}
                value={filters.status}
                onChange={(e) => change("status", e.target.value)}
              >
                {["all", "available", "mine"].map((value) => (
                  <option key={value} value={value}>
                    {t(value)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="button-row">
          {!ideas && (
            <>
              <Button
                variant="secondary"
                aria-pressed={filters.priority === "ESSENTIAL"}
                onClick={() =>
                  change(
                    "priority",
                    filters.priority === "ESSENTIAL" ? "all" : "ESSENTIAL",
                  )
                }
              >
                {t(ideas ? "quickPriority" : "quickEssential")}
              </Button>
              {!owner && (
                <Button
                  variant="secondary"
                  aria-pressed={filters.status === "available"}
                  onClick={() =>
                    change(
                      "status",
                      filters.status === "available" ? "all" : "available",
                    )
                  }
                >
                  {t("available")}
                </Button>
              )}
            </>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              ideas?.reset();
              if (pagination) {
                navigate(initial);
                return;
              }
              setFilters(initial);
              setPage(1);
            }}
          >
            {t("reset")}
          </Button>
        </div>
      </details>
      {ideas && viewControls}
      <p role="status" className="result-count">
        {t("shown", {
          count: paged.items.length,
          total: ideas?.total ?? pagination?.total ?? gifts.length,
        })}
      </p>
      {!visible.length &&
        (ideas?.total === 0 ? (
          ideas.empty
        ) : (
          <div className="stack">
            <p>{t("noResults")}</p>
            {ideas && (
              <Button
                variant="secondary"
                onClick={() => {
                  ideas.reset();
                  setFilters(initial);
                  setPage(1);
                }}
              >
                {t("reset")}
              </Button>
            )}
          </div>
        ))}
      <div
        className={`gift-grid${view === "compact" ? " gift-grid-compact" : ""}`}
      >
        {paged.items.map((gift) => (
          <div key={gift.id}>{gift.card}</div>
        ))}
      </div>
      {paged.pages > 1 && (
        <nav
          className="button-row gift-pagination"
          aria-label={p("pagination")}
        >
          <Button
            variant="secondary"
            disabled={pending || paged.page === 1}
            onClick={() =>
              pagination
                ? navigate(filters, paged.page - 1)
                : setPage(paged.page - 1)
            }
          >
            {p("previous")}
          </Button>
          <p role="status">
            {p("page", { page: paged.page, pages: paged.pages })}
          </p>
          <Button
            variant="secondary"
            disabled={pending || paged.page === paged.pages}
            onClick={() =>
              pagination
                ? navigate(filters, paged.page + 1)
                : setPage(paged.page + 1)
            }
          >
            {p("next")}
          </Button>
        </nav>
      )}
    </div>
  );
}
