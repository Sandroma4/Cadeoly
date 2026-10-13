"use client";
import { useId, useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PreservedForm } from "@/components/ui/PreservedForm";
import { saveGiftBudget, removeGiftBudget } from "@/app/actions/gift-budget";
import {
  summarizeGiftBudget,
  type BudgetReservation,
  type BudgetContribution,
} from "@/lib/gift-budget";

type SavedBudget = { scope: string; currency: string; amountCents: number };
export function GiftBudget({
  reservations,
  contributions,
  budgets,
  currencyOptions,
}: {
  reservations: BudgetReservation[];
  contributions: BudgetContribution[];
  budgets: SavedBudget[];
  currencyOptions: readonly string[];
}) {
  const t = useTranslations("giftBudget"),
    errors = useTranslations("errors"),
    locale = useLocale(),
    router = useRouter();
  const [scope, setScope] = useState("ALL"),
    [currency, setCurrency] = useState("EUR"),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const occasionId = useId(),
    currencyId = useId();
  const helpId = useId();
  const [helpOpen, setHelpOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && (window.innerWidth > 768 || budgets.length > 0)) {
      setIsOpen(true);
    }
  }, [budgets.length]);
  const occasions = [
    ...new Set([
      ...reservations.flatMap(({ gift }) =>
        gift?.occasion ? [gift.occasion] : [],
      ),
      ...contributions.flatMap((row) =>
        row.href && row.occasion ? [row.occasion] : [],
      ),
      ...budgets.flatMap((row) =>
        row.scope.startsWith("occasion:") ? [row.scope.slice(9)] : [],
      ),
    ]),
  ].sort();
  const summary = summarizeGiftBudget(reservations, contributions, scope);
  const saved = budgets.find(
    (row) => row.scope === scope && row.currency === currency,
  );
  const money = (cents: number, code: string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: code }).format(
      cents / 100,
    );
  const currencies = [
    ...new Set([
      ...summary.totals.map((row) => row.currency),
      ...budgets
        .filter((row) => row.scope === scope)
        .map((row) => row.currency),
    ]),
  ].sort();
  async function perform(amount?: string) {
    setPending(true);
    setMessage("");
    try {
      const result =
        amount === undefined
          ? await removeGiftBudget(scope, currency)
          : await saveGiftBudget(scope, currency, amount);
      if ("error" in result && result.error) setMessage(errors(result.error));
      else {
        setMessage(t(amount === undefined ? "removed" : "saved"));
        router.refresh();
      }
    } catch {
      setMessage(errors("unexpected"));
    } finally {
      setPending(false);
    }
  }
  return (
    <Card className="gift-budget-card">
      <CardContent>
        <details
          className="gift-budget-dropdown"
          open={isOpen}
          onToggle={(e) => setIsOpen(e.currentTarget.open)}
        >
          <summary className="gift-budget-summary">
            <div className="gift-budget-summary-left">
              <span className="gift-budget-icon" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <path d="M2 10h20M6 14h2" />
                </svg>
              </span>
              <h2>{t("title")}</h2>
            </div>
            <div className="gift-budget-summary-right">
              {summary.totals.length > 0 && (
                <span className="gift-budget-badge">
                  {summary.totals
                    .map((row) => money(row.totalCents, row.currency))
                    .join(" · ")}
                </span>
              )}
              <span className="gift-budget-chevron" aria-hidden="true" />
            </div>
          </summary>
          <div className="gift-budget-body stack" aria-busy={pending}>
            <div className="budget-heading">
              <p className="budget-subtitle">{t("privacy")}</p>
              <button
                type="button"
                className="budget-help-toggle"
                aria-label={t("information")}
                aria-expanded={helpOpen}
                aria-controls={helpId}
                onClick={() => setHelpOpen(!helpOpen)}
              >
                <span aria-hidden="true">ⓘ</span>
              </button>
            </div>
            <div
              id={helpId}
              className={`stack budget-help${helpOpen ? " budget-help-open" : ""}`}
            >
              <p>{t("help")}</p>
            </div>
          <div className="stack">
            <label htmlFor={occasionId}>{t("occasion")}</label>
            <select
              id={occasionId}
              value={scope}
              onChange={(event) => {
                setScope(event.target.value);
                setMessage("");
              }}
              disabled={pending}
            >
              <option value="ALL">{t("all")}</option>
              {occasions.map((occasion) => (
                <option key={occasion} value={`occasion:${occasion}`}>
                  {occasion}
                </option>
              ))}
            </select>
          </div>
          {currencies.length === 0 && <p>{t("empty")}</p>}
          {currencies.map((code) => {
            const total = summary.totals.find((row) => row.currency === code);
            const target = budgets.find(
              (row) => row.scope === scope && row.currency === code,
            );
            const committed = total?.totalCents || 0;
            return (
              <div className="stack" key={code}>
                <h3>{code}</h3>
                <p>
                  {t("reserved", {
                    amount: money(total?.reservedCents || 0, code),
                  })}
                </p>
                <p>
                  {t("contributed", {
                    amount: money(total?.contributedCents || 0, code),
                  })}
                </p>
                <p>{t("committed", { amount: money(committed, code) })}</p>
                {target && (
                  <>
                    <p>
                      {t("target", { amount: money(target.amountCents, code) })}
                    </p>
                    <p>
                      {t(
                        committed > target.amountCents
                          ? "exceeded"
                          : "remaining",
                        {
                          amount: money(
                            Math.abs(target.amountCents - committed),
                            code,
                          ),
                        },
                      )}
                    </p>
                    {target.amountCents > 0 && (
                      <progress
                        className="gift-progress"
                        value={Math.min(committed, target.amountCents)}
                        max={target.amountCents}
                        aria-label={t("target", {
                          amount: money(target.amountCents, code),
                        })}
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}
          {!!summary.unpriced && (
            <p>{t("unpriced", { count: summary.unpriced })}</p>
          )}
          {!!summary.unavailable && (
            <p>{t("unavailable", { count: summary.unavailable })}</p>
          )}
          <PreservedForm
            key={`${scope}:${currency}:${saved?.amountCents ?? ""}`}
            className="stack budget-form"
            action={(form) => perform(String(form.get("amount") || ""))}
          >
            <div className="stack">
              <label htmlFor={currencyId}>{t("currency")}</label>
              <select
                id={currencyId}
                value={currency}
                onChange={(event) => {
                  setCurrency(event.target.value);
                  setMessage("");
                }}
                disabled={pending}
              >
                {currencyOptions.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            <Input
              name="amount"
              label={t("amount")}
              type="number"
              min="0"
              max="9999999.99"
              step="0.01"
              defaultValue={saved ? (saved.amountCents / 100).toFixed(2) : ""}
              required
              disabled={pending}
            />
            <Button disabled={pending}>{t("save")}</Button>
            {saved && (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => perform()}
              >
                {t("remove")}
              </Button>
            )}
          </PreservedForm>
          <p role="status">{message}</p>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
