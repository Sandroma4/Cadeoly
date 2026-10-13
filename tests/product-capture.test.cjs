require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

function productDocument({
  price = "8 €",
  currency = "EUR",
  image = "/cable.jpg",
} = {}) {
  const product = {
    "@type": "Product",
    name: "Câble adaptateur",
    image,
    offers: { price: 8, priceCurrency: currency },
  };
  return {
    title: "Câble adaptateur - Leboncoin",
    querySelectorAll(selector) {
      return selector.includes("application/ld+json")
        ? [{ textContent: JSON.stringify(product) }]
        : [];
    },
    querySelector(selector) {
      if (selector === "h1")
        return {
          textContent: "Câble adaptateur",
          innerText: "Câble adaptateur",
        };
      if (selector === '[data-qa-id="adview_price"]' && price)
        return { innerText: price, textContent: price };
      return null;
    },
  };
}

test("page capture reads the displayed price and primary product photo", () => {
  const { extractVisibleProduct } = require("../src/lib/product-capture.ts");
  assert.deepEqual(
    extractVisibleProduct(
      productDocument({ price: "1 249,90 €" }),
      "https://www.leboncoin.fr/ad/accessoires_informatique/3261483687",
    ),
    {
      url: "https://www.leboncoin.fr/ad/accessoires_informatique/3261483687",
      title: "Câble adaptateur",
      price: "1249.90",
      image: "https://www.leboncoin.fr/cable.jpg",
    },
  );
});

test("page capture rejects unsafe photos and non-EUR prices", () => {
  const { extractVisibleProduct } = require("../src/lib/product-capture.ts");
  const data = extractVisibleProduct(
    productDocument({
      price: "$8.00",
      currency: "USD",
      image: "javascript:alert(1)",
    }),
    "https://www.vinted.fr/items/123-cable",
  );
  assert.equal(data.price, "");
  assert.equal(data.image, "");
});

test("the standalone bookmark opens a review form with captured fields", () => {
  const { productBookmarklet } = require("../src/lib/product-capture.ts");
  let opened;
  const code = productBookmarklet("https://cadeoly.example/fr/quick-add");
  vm.runInNewContext(code.replace(/^javascript:/, ""), {
    document: productDocument(),
    location: {
      href: "https://www.leboncoin.fr/ad/accessoires_informatique/3261483687",
    },
    URL,
    URLSearchParams,
    window: {
      open: (url, target, features) => {
        opened = new URL(url);
        assert.equal(target, "_blank");
        assert.equal(features, "noopener,noreferrer");
      },
    },
  });
  assert.equal(opened.origin, "https://cadeoly.example");
  assert.equal(opened.pathname, "/fr/quick-add");
  assert.equal(opened.searchParams.get("title"), "Câble adaptateur");
  assert.equal(opened.searchParams.get("price"), "8.00");
  assert.equal(
    opened.searchParams.get("image"),
    "https://www.leboncoin.fr/cable.jpg",
  );
});

test("shared capture keeps validated fields through login and list creation", () => {
  const { sharedProduct } = require("../src/lib/convenience.ts");
  const { returnPath } = require("../src/lib/return-path.ts");
  const data = sharedProduct({
    url: "https://www.vinted.fr/items/123-cable",
    title: "Câble",
    price: "12,50",
    image: "https://images.vinted.net/cable.webp",
  });
  assert.equal(data.price, "12.50");
  assert.equal(data.image, "https://images.vinted.net/cable.webp");
  const next = "/fr/quick-add?" + new URLSearchParams(data);
  assert.equal(returnPath(next, "fr"), next);
  assert.equal(
    sharedProduct({ image: "javascript:alert(1)", price: "99999999999" }).image,
    "",
  );
  assert.equal(
    sharedProduct({ image: "https://127.0.0.1/secret", price: "USD 12" }).price,
    "",
  );
});

function photoAction({ owner = "owner", ownsList = true, download }) {
  const source = require("typescript").transpileModule(
    require("node:fs").readFileSync(
      "src/app/actions/product-preview.ts",
      "utf8",
    ),
    { compilerOptions: { module: 1, target: 7, esModuleInterop: true } },
  ).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    Buffer,
    process,
    console: { warn() {} },
    require(id) {
      if (id === "@/lib/action-auth") return { listOwnerId: async () => owner };
      if (id === "@/lib/prisma")
        return {
          prisma: {
            wishlist: {
              findFirst: async () => (ownsList ? { id: "list" } : null),
            },
          },
        };
      if (id === "@/lib/product-preview")
        return {
          ...require("../src/lib/product-preview.ts"),
          readPublicResource: download,
        };
      if (id === "@/lib/product-preview-rendered")
        return {
          readProductPage: () => {
            throw new Error("Captured photos must not re-scrape the merchant");
          },
        };
      return require(id);
    },
  });
  return exports.previewProduct;
}

test("captured photos are converted after ownership checks without reopening the merchant", async () => {
  const bytes = await require("sharp")({
    create: { width: 8, height: 8, channels: 3, background: "#557799" },
  })
    .png()
    .toBuffer();
  let calls = 0;
  const action = photoAction({
    download: async (url, limit, kind) => {
      calls++;
      assert.equal(url, "https://images.vinted.net/cable.webp");
      assert.equal(kind, "image");
      assert.equal(limit, 5 * 1024 * 1024);
      return { bytes, url };
    },
  });
  const result = await action(
    "list",
    "https://www.vinted.fr/items/123-cable",
    "https://images.vinted.net/cable.webp",
  );
  assert.equal(calls, 1);
  assert.equal(
    (await require("sharp")(Buffer.from(result.photo, "base64")).metadata())
      .format,
    "webp",
  );
});

test("captured photos reject unauthorized lists and internal image addresses", async () => {
  let calls = 0;
  const download = async () => {
    calls++;
    throw new Error("Unexpected download");
  };
  for (const options of [{ owner: null }, { ownsList: false }]) {
    const result = await photoAction({ ...options, download })(
      "list",
      "https://www.vinted.fr/items/123-cable",
      "https://images.vinted.net/cable.webp",
    );
    assert.equal(result.error, true);
  }
  const result = await photoAction({ download })(
    "list",
    "https://www.vinted.fr/items/123-cable",
    "https://127.0.0.1/secret",
  );
  assert.equal(result.photo || "", "");
  assert.equal(calls, 0);
});
