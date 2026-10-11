"use client";
import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { GiftBrowser } from "./GiftBrowser";
import type { SearchableGift } from "@/lib/gift-search";
import {
  matchesSuggestionPrice,
  suggestionPriceRanges,
  type SuggestionPriceRange,
} from "@/lib/gift-suggestions";
export function GiftIdeas({
  gifts,
}: {
  gifts: (SearchableGift & {
    recipient: string;
    event: string;
    isFavorite: boolean;
    card: ReactNode;
  })[];
}) {
  const suggestions = useTranslations("giftSuggestions");
  const locale = useLocale();
  const currencies = [
    ...new Set(
      gifts
        .filter((gift) => gift.priceCents !== null)
        .map((gift) => gift.currency || "EUR"),
    ),
  ].sort();
  const [priceRange, setPriceRange] = useState<SuggestionPriceRange | "">("");
  const [currency, setCurrency] = useState(
    currencies.includes("EUR") ? "EUR" : currencies[0] || "EUR",
  );
  const money = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  const t = useTranslations("convenience"),
    favorites = useTranslations("giftFavorites"),
    [favoritesOnly, setFavoritesOnly] = useState(false),
    [recipient, setRecipient] = useState(""),
    [event, setEvent] = useState("");
  return (
    <div className="stack gift-ideas-page">
      <header className="gift-ideas-header">
        <div>
          <span className="visual-badge">{t("ideasBadge")}</span>
        </div>
        <h1>{t("ideas")}</h1>
        <p className="gift-ideas-subtitle">{t("ideasHelp")}</p>
      </header>

      <section className="gift-ideas-filter-card stack" aria-label={t("ideas")}>
        <div className="gift-ideas-filter-top">
          <label className="favorite-filter-toggle">
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(e) => setFavoritesOnly(e.target.checked)}
            />
            <span className="favorite-toggle-content">
              <span className="star-icon" aria-hidden="true">
                {favoritesOnly ? "★" : "☆"}
              </span>
              <span>{favorites("only")}</span>
            </span>
          </label>
          <span className="favorites-help-hint">{favorites("help")}</span>
        </div>

        <div className="gift-ideas-filter-grid">
          <div className="filter-field">
            <label htmlFor="filter-price-range">{suggestions("range")}</label>
            <select
              id="filter-price-range"
              aria-label={suggestions("range")}
              value={priceRange}
              onChange={(e) =>
                setPriceRange(e.target.value as SuggestionPriceRange | "")
              }
            >
              <option value="">{suggestions("allPrices")}</option>
              {suggestionPriceRanges.map((range) => (
                <option key={range} value={range}>
                  {suggestions(range, {
                    a: money(
                      range === "under25" || range === "25to50"
                        ? 25
                        : range === "50to100"
                          ? 50
                          : 100,
                    ),
                    b: money(range === "25to50" ? 50 : 100),
                  })}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="filter-currency">{suggestions("currency")}</label>
            <select
              id="filter-currency"
              aria-label={suggestions("currency")}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {(currencies.length ? currencies : ["EUR"]).map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="filter-recipient">{t("recipient")}</label>
            <select
              id="filter-recipient"
              aria-label={t("recipient")}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            >
              <option value="">{t("allRecipients")}</option>
              {[...new Set(gifts.map((g) => g.recipient))].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="filter-event">{t("event")}</label>
            <select
              id="filter-event"
              aria-label={t("event")}
              value={event}
              onChange={(e) => setEvent(e.target.value)}
            >
              <option value="">{t("allEvents")}</option>
              {[...new Set(gifts.map((g) => g.event).filter(Boolean))].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </select>
          </div>
        </div>

        {priceRange && (
          <p className="form-hint">
            {suggestions("currencyHelp", { currency })}
          </p>
        )}
      </section>

      <GiftBrowser
        key={JSON.stringify([
          recipient,
          event,
          favoritesOnly,
          priceRange,
          currency,
        ])}
        owner={false}
        gifts={gifts.filter(
          (g) =>
            (favoritesOnly ? g.isFavorite : !g.isReserved) &&
            (!recipient || g.recipient === recipient) &&
            (!event || g.event === event) &&
            matchesSuggestionPrice(g, priceRange, currency),
        )}
      />
    </div>
  );
}
