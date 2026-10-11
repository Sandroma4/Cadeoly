export const suggestionPriceRanges = [
  "under25",
  "25to50",
  "50to100",
  "100plus",
] as const;

export type SuggestionPriceRange = (typeof suggestionPriceRanges)[number];

const bounds: Record<SuggestionPriceRange, readonly [number, number]> = {
  under25: [0, 2500],
  "25to50": [2500, 5000],
  "50to100": [5000, 10000],
  "100plus": [10000, Infinity],
};

export function matchesSuggestionPrice(
  gift: { priceCents: number | null; currency: string | null },
  range: SuggestionPriceRange | "",
  currency: string,
) {
  if (!range) return true;
  const [min, max] = bounds[range];
  return (
    gift.priceCents !== null &&
    (gift.currency || "EUR") === currency &&
    gift.priceCents >= min &&
    gift.priceCents < max
  );
}

export function partitionGiftHistory<T extends { preparationStatus?: string }>(
  reservations: T[],
) {
  return {
    active: reservations.filter((row) => row.preparationStatus !== "GIVEN"),
    history: reservations.filter((row) => row.preparationStatus === "GIVEN"),
  };
}
