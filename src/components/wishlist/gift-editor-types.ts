export type Gift = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  priceCents: number | null;
  currency?: string | null;
  priority: string;
  image: string | null;
  size: string | null;
  color: string | null;
  model: string | null;
  isGroupGift?: boolean;
  alternativeUrls?: string;
};
