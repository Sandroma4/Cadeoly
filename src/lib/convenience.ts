export function sharedProduct(input: {
  url?: string;
  text?: string;
  title?: string;
  price?: string;
  image?: string;
}) {
  const candidate =
    input.url || input.text?.match(/https?:\/\/[^\s<>]+/)?.[0] || "";
  let url = "";
  try {
    const parsed = new URL(candidate);
    if (
      ["http:", "https:"].includes(parsed.protocol) &&
      candidate.length <= 2048 &&
      !parsed.username &&
      !parsed.password
    )
      url = candidate;
  } catch {}
  let image = "";
  try {
    const parsed = new URL(input.image || "");
    if (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      parsed.hostname.includes(".") &&
      !/^[\d.]+$/.test(parsed.hostname) &&
      parsed.toString().length <= 2048
    )
      image = parsed.toString();
  } catch {}
  const amount = (input.price || "").replace(",", ".");
  const price =
    /^\d+(?:\.\d{1,2})?$/.test(amount) && Number(amount) <= 9999999.99
      ? Number(amount).toFixed(2)
      : "";
  return { url, title: (input.title || "").trim().slice(0, 120), price, image };
}
export function ownerPreview<
  T extends {
    isOwner: boolean;
    canEdit: boolean;
    items: {
      isReserved: boolean;
      reservedByMe: boolean;
      contributedCents: number;
      myContributionCents: number;
    }[];
  },
>(list: T): T {
  return {
    ...list,
    canEdit: false,
    items: list.items.map((item) => ({
      ...item,
      isReserved: false,
      reservedByMe: false,
      contributedCents: 0,
      myContributionCents: 0,
    })),
  };
}
