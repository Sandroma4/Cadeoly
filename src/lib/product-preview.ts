import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";

// Only public IPv4 destinations are used; pin the checked address to prevent DNS rebinding.
export function publicAddress(address: string) {
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && [0, 168].includes(b)) ||
    (a === 198 && [18, 19, 51].includes(b)) ||
    (a === 203 && b === 0)
  );
}
export function productUrl(value: string) {
  if (value.length > 2048) throw new Error("invalidUrl");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !url.hostname.includes(".") ||
    (isIP(url.hostname) && !publicAddress(url.hostname))
  )
    throw new Error("invalidUrl");
  url.hash = "";
  return url;
}
export async function readPublicResource(
  value: string,
  limit: number,
  kind: "html" | "image",
  hops = 0,
): Promise<{ bytes: Buffer; url: string }> {
  const url = productUrl(value);
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  if (
    !addresses.length ||
    addresses.some(({ address }) => !publicAddress(address))
  )
    throw new Error("invalidUrl");
  const response = await new Promise<{ bytes?: Buffer; redirect?: string }>(
    (resolve, reject) => {
      const req = request(
        url,
        {
          agent: false,
          family: 4,
          ...{ autoSelectFamily: false },
          lookup: (_host, _options, callback) =>
            callback(null, addresses[0].address, 4),
          headers: {
            ...(kind === "html"
              ? { "User-Agent": "Cadéoly/1.0 (product preview)" }
              : {}),
            Accept:
              kind === "html" ? "text/html" : "image/jpeg,image/png,image/webp",
            "Accept-Encoding": "identity",
          },
        },
        (res) => {
          if (
            [301, 302, 303, 307, 308].includes(res.statusCode || 0) &&
            res.headers.location
          ) {
            res.destroy();
            resolve({
              redirect: new URL(res.headers.location, url).toString(),
            });
            return;
          }
          const type = String(res.headers["content-type"] || "").split(";")[0];
          if (
            res.statusCode !== 200 ||
            !(kind === "html"
              ? ["text/html", "application/xhtml+xml"].includes(type)
              : ["image/jpeg", "image/png", "image/webp"].includes(type))
          ) {
            res.destroy();
            reject(
              Object.assign(new Error("unsupported"), {
                status: res.statusCode,
              }),
            );
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > limit) {
              res.destroy(new Error("tooLarge"));
            } else chunks.push(chunk);
          });
          res.on("error", reject);
          res.on("end", () => resolve({ bytes: Buffer.concat(chunks) }));
        },
      );
      const timer = setTimeout(() => req.destroy(new Error("timeout")), 8000);
      req.on("close", () => clearTimeout(timer));
      req.on("error", reject);
      req.end();
    },
  );
  if (response.redirect) {
    if (hops >= 3) throw new Error("redirects");
    return readPublicResource(response.redirect, limit, kind, hops + 1);
  }
  return { bytes: response.bytes!, url: url.toString() };
}
function decode(value: string) {
  const entities: Record<string, string> = {
    eacute: "é",
    egrave: "è",
    ecirc: "ê",
    agrave: "à",
    acirc: "â",
    ccedil: "ç",
    ocirc: "ô",
    ugrave: "ù",
    ucirc: "û",
    nbsp: " ",
  };
  value = value.replace(
    /&([a-z]+);/gi,
    (match, name) => entities[name.toLowerCase()] || match,
  );
  return value
    .replace(
      /&(?:amp|quot|apos|lt|gt|#39|#(\d+)|#x([0-9a-f]+));/gi,
      (match, decimal, hex) => {
        if (decimal || hex) {
          const code = parseInt(decimal || hex, hex ? 16 : 10);
          return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
        }
        return (
          (
            {
              "&amp;": "&",
              "&quot;": '"',
              "&apos;": "'",
              "&#39;": "'",
              "&lt;": "<",
              "&gt;": ">",
            } as Record<string, string>
          )[match.toLowerCase()] || match
        );
      },
    )
    .replace(/\s+/g, " ")
    .trim();
}
function structuredProduct(html: string): Record<string, unknown> {
  for (const script of html.matchAll(
    /<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      let root: unknown;
      try {
        root = JSON.parse(script[1]);
      } catch {
        root = JSON.parse(decode(script[1]));
      }
      const queue: unknown[] = [root];
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
        )
          return data;
        for (const key of ["mainEntity", "@graph", "item"])
          if (data[key]) queue.push(data[key]);
      }
    } catch {}
  }
  return {};
}
function merchantProduct(html: string, base: string): Record<string, unknown> {
  const host = new URL(base).hostname;
  const leboncoin = /(^|\.)leboncoin\.fr$/.test(host);
  const vinted = /(^|\.)vinted\.fr$/.test(host);
  if (!leboncoin && !vinted) return {};
  for (const script of html.matchAll(
    /<script\b[^>]*\bid\s*=\s*["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const props = JSON.parse(script[1])?.props?.pageProps;
      // Read only the primary listing, never recommendations or other sellers.
      const item = leboncoin ? props?.ad : props?.item;
      if (!item || typeof item !== "object") continue;
      return {
        name: leboncoin ? item.subject : item.title,
        image: leboncoin
          ? item.images?.urls_large?.[0] || item.images?.urls?.[0]
          : item.photos?.[0]?.full_size_url || item.photos?.[0]?.url,
        offers: {
          price: leboncoin ? item.price?.[0] : item.price?.amount,
          priceCurrency: leboncoin ? "EUR" : item.price?.currency,
        },
      };
    } catch {}
  }
  return {};
}
export function parseProduct(html: string, base: string) {
  if (
    /\/(?:login|signin|sign-in|risk\/challenge)(?:\.html|\/|$)/i.test(
      new URL(base).pathname,
    )
  )
    return { title: "", price: "", image: "" };
  const pageTitle = decode(
    html.match(/<title\b[^>]*>([^<]*)<\/title>/i)?.[1] || "",
  );
  if (
    /^(?:403\b|access denied\b|accès (?:bloqué|refusé)\b|forbidden\b|just a moment\b|robot check\b|verify (?:you are|you're) human\b)/i.test(
      pageTitle,
    )
  )
    return { title: "", price: "", image: "" };
  const meta: Record<string, string> = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs: Record<string, string> = {};
    for (const match of tag.matchAll(
      /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
    ))
      attrs[match[1].toLowerCase()] = decode(match[2] ?? match[3] ?? match[4]);
    const key = attrs.property || attrs.name || attrs.itemprop;
    if (key && attrs.content && !meta[key.toLowerCase()])
      meta[key.toLowerCase()] = attrs.content;
  }
  const product = {
    ...merchantProduct(html, base),
    ...structuredProduct(html),
  };
  const productName =
    typeof product.name === "string" ? decode(product.name) : "";
  const offers = (
    Array.isArray(product.offers) ? product.offers : [product.offers]
  ).flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const specification = value.priceSpecification;
    return [
      { ...value, price: value.price ?? value.lowPrice },
      ...(Array.isArray(specification) ? specification : [specification]).map(
        (price) => ({
          ...price,
          priceCurrency: price?.priceCurrency || value.priceCurrency,
        }),
      ),
    ];
  });
  const offer = offers.find(
    (value) =>
      value &&
      typeof value === "object" &&
      String(value.priceCurrency).toUpperCase() === "EUR" &&
      /^(?:\d+)(?:[.,]\d{1,2})?$/.test(String(value.price)) &&
      Number(String(value.price).replace(",", ".")) <= 9999999.99,
  );
  const amazon =
    /(^|\.)amazon\.(fr|com|de|it|es|nl|pl|se|com\.be|co\.uk|ca|com\.au|co\.jp)$/.test(
      new URL(base).hostname,
    );
  if (
    amazon &&
    /(?:id=["']captchacharacters["']|action=["'][^"']*validateCaptcha)/i.test(
      html,
    )
  )
    return { title: "", price: "", image: "" };
  const amazonTitle = amazon
    ? decode(
        html
          .match(
            /<span\b[^>]*\bid=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i,
          )?.[1]
          .replace(/<[^>]*>/g, " ") || "",
      )
    : "";
  const title = (
    amazonTitle ||
    productName ||
    meta["og:title"] ||
    meta["twitter:title"] ||
    meta["name"] ||
    pageTitle
  ).slice(0, 120);
  let amazonPrice = "";
  if (amazon) {
    const label =
      html.match(
        /<span\b[^>]*\bid=["']apex-pricetopay-accessibility-label["'][^>]*>([\s\S]*?)<\/span>/i,
      )?.[1] || "";
    const amount = decode(label.replace(/<[^>]*>/g, "")).match(
      /^(\d[\d .]*[,.]\d{2})\s*€$/,
    );
    if (amount) amazonPrice = amount[1].replace(/[ .]/g, "").replace(",", ".");
  }
  const currency =
    meta["product:price:currency"] ||
    meta["og:price:currency"] ||
    meta["pricecurrency"];
  const rawPrice =
    meta["product:price:amount"] ||
    meta["og:price:amount"] ||
    meta["price"] ||
    "";
  let price =
    /^\d+(?:[.,]\d{1,2})?$/.test(rawPrice) &&
    currency === "EUR" &&
    Number(rawPrice.replace(",", ".")) <= 9999999.99
      ? Number(rawPrice.replace(",", ".")).toFixed(2)
      : "";
  if (offer && !amazonPrice)
    price = Number(String(offer.price).replace(",", ".")).toFixed(2);
  if (
    !price &&
    /^\d{1,7}\.\d{2}$/.test(amazonPrice) &&
    Number(amazonPrice) <= 9999999.99
  )
    price = amazonPrice;
  let image = "";
  try {
    const tag = amazon
      ? html.match(/<img\b[^>]*\bid=["']landingImage["'][^>]*>/i)?.[0] || ""
      : "";
    const attr = (name: string) =>
      decode(
        tag
          .match(new RegExp(name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')", "i"))
          ?.slice(1)
          .find(Boolean) || "",
      );
    let amazonImage = attr("data-old-hires") || attr("src");
    try {
      const candidates = JSON.parse(attr("data-a-dynamic-image") || "{}");
      amazonImage =
        Object.entries(candidates)
          .filter(
            (entry): entry is [string, number[]] =>
              Array.isArray(entry[1]) &&
              entry[1].length === 2 &&
              entry[1].every((value) => typeof value === "number"),
          )
          .sort((a, b) => b[1][0] * b[1][1] - a[1][0] * a[1][1])[0]?.[0] ||
        amazonImage;
    } catch {}
    const images = Array.isArray(product.image)
      ? product.image
      : [product.image];
    const productImage = images
      .map((value) =>
        typeof value === "string"
          ? value
          : value &&
              typeof value === "object" &&
              "url" in value &&
              typeof value.url === "string"
            ? value.url
            : "",
      )
      .find(Boolean);
    const raw =
      amazonImage ||
      productImage ||
      meta["og:image:secure_url"] ||
      meta["og:image"] ||
      meta["twitter:image"] ||
      meta["twitter:image:src"] ||
      meta["image"];
    if (raw) image = productUrl(new URL(raw, base).toString()).toString();
  } catch {}
  return { title, price, image };
}

export function productTitleFromUrl(value: string) {
  try {
    const url = productUrl(value);
    const patterns: [RegExp, RegExp][] = [
      [/(^|\.)joybuy\.(?:fr|de|nl|co\.uk|com)$/, /^\/dp\/([^/]+)\/\d+\/?$/],
      [/(^|\.)vinted\.fr$/, /^\/items\/\d+-([^/]+)\/?$/],
      [/(^|\.)e\.leclerc$/, /^\/fp\/([^/]+)-\d+\/?$/],
      [/(^|\.)lidl\.fr$/, /^\/p\/([^/]+)\/p\d+\/?$/],
      [/(^|\.)carrefour\.fr$/, /^\/p\/([^/]+)-\d+\/?$/],
      [/(^|\.)shein\.com$/, /^\/(?:[a-z]{2}\/)?([^/]+)-p-\d+\.html$/],
      [/(^|\.)temu\.com$/, /^\/(?:[a-z]{2}\/)?([^/]+)-g-\d+\.html$/],
      [/(^|\.)cdiscount\.com$/, /^\/(?:[^/]+\/)+([^/]+)\/f-[^/]+\.html$/],
    ];
    const pattern = patterns.find(([host]) => host.test(url.hostname))?.[1];
    const slug = pattern && url.pathname.match(pattern)?.[1];
    if (!slug) return "";
    return decodeURIComponent(slug).replace(/[-_]+/g, " ").trim().slice(0, 120);
  } catch {
    return "";
  }
}

export function productImageFromUrl(value: string) {
  try {
    const url = productUrl(value);
    if (
      !/(^|\.)temu\.com$/.test(url.hostname) ||
      !/^\/(?:[a-z]{2}\/)?goods\.html$/.test(url.pathname) ||
      !/^\d+$/.test(url.searchParams.get("goods_id") || "")
    )
      return "";
    const image = productUrl(
      url.searchParams.get("share_img") ||
        url.searchParams.get("top_gallery_url") ||
        "",
    );
    return image.hostname === "img.kwcdn.com" ? image.toString() : "";
  } catch {
    return "";
  }
}
