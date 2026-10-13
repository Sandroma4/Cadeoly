// Self-contained: the bookmark executes this function on the open product page.
export function extractVisibleProduct(
  doc: Document = document,
  pageUrl = location.href,
) {
  const meta = (name: string) =>
    doc.querySelector<HTMLMetaElement>(
      `meta[property="${name}"], meta[name="${name}"], meta[itemprop="${name}"]`,
    )?.content || "";
  const money = (value: unknown, currency = "") => {
    const raw = String(value ?? "").trim();
    if (
      /[$£]|\b(?:USD|GBP)\b/i.test(raw) ||
      !(currency.toUpperCase() === "EUR" || /€|\bEUR\b/i.test(raw))
    )
      return "";
    const token = (raw.match(/(\d[\d.,\s]*)\s*(?:€|EUR)/i)?.[1] || raw).replace(
      /\s/g,
      "",
    );
    if (!/^\d[\d.,]*$/.test(token)) return "";
    const separator = Math.max(token.lastIndexOf("."), token.lastIndexOf(","));
    const decimal = separator >= 0 && token.length - separator <= 3;
    const normalized = decimal
      ? token.slice(0, separator).replace(/[.,]/g, "") +
        "." +
        token.slice(separator + 1)
      : token.replace(/[.,]/g, "");
    const amount = Number(normalized);
    return Number.isFinite(amount) && amount <= 9999999.99
      ? amount.toFixed(2)
      : "";
  };
  const safeUrl = (value: unknown) => {
    try {
      const url = new URL(String(value || ""), pageUrl);
      return value &&
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        url.hostname.includes(".") &&
        !/^[\d.]+$/.test(url.hostname) &&
        url.toString().length <= 2048
        ? url.toString()
        : "";
    } catch {
      return "";
    }
  };
  let product: Record<string, unknown> = {};
  for (const script of doc.querySelectorAll(
    'script[type="application/ld+json"]',
  )) {
    try {
      const queue: unknown[] = [JSON.parse(script.textContent || "{}")];
      for (let i = 0; i < queue.length && i < 5000; i++) {
        const node = queue[i];
        if (!node || typeof node !== "object") continue;
        if (Array.isArray(node)) {
          queue.push(...node);
          continue;
        }
        const data = node as Record<string, unknown>;
        const types = Array.isArray(data["@type"])
          ? data["@type"]
          : [data["@type"]];
        if (
          types.some(
            (type) =>
              typeof type === "string" && /(?:^|[/#])Product$/i.test(type),
          )
        ) {
          product = data;
          break;
        }
        for (const key of ["@graph", "mainEntity", "item"])
          if (data[key]) queue.push(data[key]);
      }
      if (product.name) break;
    } catch {}
  }
  let price = "";
  for (const selector of [
    '[data-qa-id="adview_price"]',
    '[data-testid="item-price"]',
    '[data-testid="goods-price"]',
    ".product-intro__head-price",
    ".goods-price",
    '[itemprop="price"]',
  ]) {
    const element = doc.querySelector<HTMLElement>(selector);
    if (element && (!element.getClientRects || element.getClientRects().length))
      price = money(element.innerText || element.textContent);
    if (price) break;
  }
  const offers = Array.isArray(product.offers)
    ? product.offers
    : [product.offers];
  for (const offer of offers) {
    if (price || !offer || typeof offer !== "object") continue;
    const data = offer as Record<string, unknown>;
    price = money(
      data.price ?? data.lowPrice,
      String(data.priceCurrency || ""),
    );
  }
  if (!price)
    price = money(
      meta("product:price:amount") || meta("og:price:amount") || meta("price"),
      meta("product:price:currency") ||
        meta("og:price:currency") ||
        meta("priceCurrency"),
    );
  const images = Array.isArray(product.image) ? product.image : [product.image];
  let image = "";
  for (const value of images) {
    image = safeUrl(typeof value === "object" && value ? value.url : value);
    if (image) break;
  }
  if (!image)
    image = safeUrl(
      meta("og:image:secure_url") || meta("og:image") || meta("twitter:image"),
    );
  if (!image) {
    const candidate = Array.from(
      doc.querySelectorAll<HTMLImageElement>("main img, [role=main] img"),
    ).find((img) => img.naturalWidth >= 200 && img.naturalHeight >= 200);
    image = safeUrl(candidate?.currentSrc || candidate?.src);
  }
  const title =
    doc.querySelector<HTMLElement>("h1")?.innerText ||
    product.name ||
    meta("og:title") ||
    doc.title ||
    "";
  return {
    url: safeUrl(pageUrl),
    title: String(title).replace(/\s+/g, " ").trim().slice(0, 120),
    price,
    image,
  };
}

export function productBookmarklet(destination: string) {
  const target = new URL(destination);
  if (
    !["https:", "http:"].includes(target.protocol) ||
    target.username ||
    target.password ||
    !/^\/(fr|en)\/quick-add$/.test(target.pathname)
  )
    throw new Error("invalidDestination");
  return `javascript:(()=>{const p=(${extractVisibleProduct.toString()})();const u=new URL(${JSON.stringify(target.toString())});u.search=new URLSearchParams(p).toString();window.open(u.toString(),"_blank","noopener,noreferrer");})()`;
}
