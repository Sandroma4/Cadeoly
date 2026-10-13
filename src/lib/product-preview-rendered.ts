import {
  parseProduct,
  productUrl,
  readPublicResource,
} from "./product-preview";

const merchants = [
  "leboncoin.fr",
  "vinted.fr",
  "temu.com",
  "shein.com",
  "e.leclerc",
  "lidl.fr",
  "carrefour.fr",
  "cdiscount.com",
  "amazon.fr",
];

function merchant(host: string) {
  return merchants.find(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

// Used only when the direct request fails or omits product fields.
// Only public merchant URLs are sent; no user cookies or account data are forwarded.
export async function readRenderedProduct(value: string) {
  try {
    const url = productUrl(value);
    const domain = merchant(url.hostname);
    if (!domain) return null;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (process.env.FIRECRAWL_API_KEY)
      headers.Authorization = `Bearer ${process.env.FIRECRAWL_API_KEY}`;
    const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers,
      redirect: "error",
      body: JSON.stringify({
        url: url.toString(),
        formats: ["rawHtml"],
        timeout: 30000,
        maxAge: 300000,
      }),
      signal: AbortSignal.timeout(35000),
    });
    if (!response.ok) return null;
    const result = await response.json();
    if (
      !result.success ||
      typeof result.data?.rawHtml !== "string" ||
      result.data.rawHtml.length > 4 * 1024 * 1024
    )
      return null;
    const finalUrl = productUrl(result.data.metadata?.url || url.toString());
    if (merchant(finalUrl.hostname) !== domain || finalUrl.pathname === "/")
      return null;
    const data = parseProduct(result.data.rawHtml, finalUrl.toString());
    // Login/storefront/challenge pages must not masquerade as product previews.
    return data.title && data.price && data.image ? data : null;
  } catch {
    return null;
  }
}

export async function readProductPage(value: string) {
  let url = productUrl(value).toString();
  let data = { title: "", price: "", image: "" };
  try {
    const page = await readPublicResource(url, 4 * 1024 * 1024, "html");
    url = page.url;
    data = parseProduct(page.bytes.toString("utf8"), url);
  } catch {}
  if (!data.title || !data.price || !data.image) {
    // Keep the original product URL: the direct response may be a login or CAPTCHA.
    const rendered = await readRenderedProduct(value);
    if (rendered)
      data = {
        title: data.title || rendered.title,
        price: data.price || rendered.price,
        image: data.image || rendered.image,
      };
  }
  return { data, url };
}
