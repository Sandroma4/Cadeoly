export type BudgetReservation = {
  gift: {
    priceCents: number | null;
    currency: string | null;
    quantity: number;
    occasion: string | null;
  } | null;
};
export type BudgetContribution = {
  amountCents: number;
  currency: string | null;
  occasion: string | null;
  href: string | null;
};
export const budgetCurrencies = Intl.supportedValuesOf("currency");
export function parseGiftBudget(
  scope: string,
  currency: string,
  amount: string,
) {
  if (
    !(
      scope === "ALL" ||
      (scope.startsWith("occasion:") && scope.length > 9 && scope.length <= 209)
    ) ||
    !budgetCurrencies.includes(currency) ||
    !/^\d{1,7}(?:\.\d{1,2})?$/.test(amount)
  )
    return null;
  return { scope, currency, amountCents: Math.round(Number(amount) * 100) };
}
export function summarizeGiftBudget(
  reservations: BudgetReservation[],
  contributions: BudgetContribution[],
  scope: string,
) {
  const totals = new Map<
    string,
    {
      currency: string;
      reservedCents: number;
      contributedCents: number;
      totalCents: number;
    }
  >();
  let unpriced = 0,
    unavailable = 0;
  const matches = (occasion: string | null) =>
    scope === "ALL" || scope === `occasion:${occasion}`;
  const add = (
    currency: string | null,
    cents: number,
    kind: "reservedCents" | "contributedCents",
  ) => {
    const code = currency || "EUR";
    const row = totals.get(code) || {
      currency: code,
      reservedCents: 0,
      contributedCents: 0,
      totalCents: 0,
    };
    row[kind] += cents;
    row.totalCents += cents;
    totals.set(code, row);
  };
  for (const { gift } of reservations) {
    if (!gift) {
      unavailable++;
      continue;
    }
    if (!matches(gift.occasion)) continue;
    if (gift.priceCents === null) {
      unpriced++;
      continue;
    }
    add(gift.currency, gift.priceCents * gift.quantity, "reservedCents");
  }
  for (const row of contributions) {
    if (!row.href) {
      unavailable++;
      continue;
    }
    if (matches(row.occasion))
      add(row.currency, row.amountCents, "contributedCents");
  }
  return {
    totals: [...totals.values()].sort((a, b) =>
      a.currency.localeCompare(b.currency),
    ),
    unpriced,
    unavailable,
  };
}
