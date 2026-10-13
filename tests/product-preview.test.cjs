require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  publicAddress,
  productUrl,
  parseProduct,
  readPublicResource,
} = require("../src/lib/product-preview.ts");
test("Amazon product fields prefer the actual product and preserve EUR prices", () => {
  const html = `<title>Merchant title</title><span class="a-offscreen">999,00 €</span>
    <span id="productTitle">Caf&eacute; &amp; cadeau</span>
    <span id="apex-pricetopay-accessibility-label">1 249,90 €</span>
    <img id="landingImage" data-a-dynamic-image="{&quot;https://example.com/small.jpg&quot;:[100,100],&quot;https://example.com/large.jpg&quot;:[800,600]}">`;
  assert.deepEqual(parseProduct(html, "https://www.amazon.fr/dp/example"), {
    title: "Café & cadeau",
    price: "1249.90",
    image: "https://example.com/large.jpg",
  });
  assert.equal(parseProduct(html, "https://amazon.fr.example.com").price, "");
  assert.equal(
    parseProduct(
      html.replace("1 249,90 €", "$1,249.90"),
      "https://www.amazon.com",
    ).price,
    "",
  );
});
test("Amazon challenge pages do not become proposed gifts", () => {
  assert.deepEqual(
    parseProduct(
      '<title>Amazon CAPTCHA</title><input id="captchacharacters">',
      "https://www.amazon.fr",
    ),
    { title: "", price: "", image: "" },
  );
});
test("product previews reject internal destinations and unsafe schemes", async () => {
  for (const value of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.100.100.200",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
  ])
    assert.equal(publicAddress(value), false, value);
  assert.equal(publicAddress("8.8.8.8"), true);
  for (const value of [
    "http://example.com",
    "https://user:password@example.com",
    "https://example.com:8443",
    "https://localhost",
    "https://127.0.0.1",
    "file:///tmp/test",
  ]) {
    assert.throws(() => productUrl(value));
  }
  await assert.rejects(() =>
    readPublicResource("https://127.0.0.1", 1024, "html"),
  );
});
test("product metadata handles attribute ordering, escaping and relative images", () => {
  const data = parseProduct(
    `<meta content="Caf&eacute; &amp; cadeau" property="og:title"><meta property='product:price:amount' content='12,50'><meta content='EUR' property='product:price:currency'><meta property='og:image' content='/gift.jpg'>`,
    "https://example.com/products/1",
  );
  assert.equal(data.title, "Café & cadeau");
  assert.equal(data.price, "12.50");
  assert.equal(data.image, "https://example.com/gift.jpg");
  assert.equal(
    parseProduct(
      `<meta property="product:price:amount" content="24"><meta property="product:price:currency" content="USD">`,
      "https://example.com",
    ).price,
    "",
  );
  assert.equal(
    parseProduct(
      `<meta property="og:image" content="https://127.0.0.1/private">`,
      "https://example.com",
    ).image,
    "",
  );
  assert.equal(
    parseProduct("<title>A simple gift</title>", "https://example.com").title,
    "A simple gift",
  );
});

test("structured product data supports graphs, multiple offers and image objects", () => {
  const html = `<meta property="og:title" content="Generic store"><script type="application/ld+json">${JSON.stringify(
    {
      "@graph": [
        { "@type": "Organization", name: "Store" },
        {
          "@type": ["Thing", "Product"],
          name: "Café & cadeau",
          image: [{ url: "/product.webp" }],
          offers: [
            { price: 99, priceCurrency: "USD" },
            { price: "24.90", priceCurrency: "EUR" },
          ],
        },
      ],
    },
  )}</script>`;
  assert.deepEqual(parseProduct(html, "https://example.com/gift"), {
    title: "Café & cadeau",
    price: "24.90",
    image: "https://example.com/product.webp",
  });
});
test("malformed structured data falls back to sharing metadata and rejects foreign prices", () => {
  assert.deepEqual(
    parseProduct(
      '<script type="application/ld+json">broken</script><meta property="og:title" content="Gift"><meta property="twitter:image:src" content="/gift.jpg">',
      "https://example.com",
    ),
    { title: "Gift", price: "", image: "https://example.com/gift.jpg" },
  );
  assert.equal(
    parseProduct(
      '<script type="application/ld+json">{"@type":"Product","name":"Gift","offers":{"price":"29","priceCurrency":"USD"}}</script>',
      "https://example.com",
    ).price,
    "",
  );
});
test("microdata metadata and structured unsafe images retain URL validation", () => {
  assert.deepEqual(
    parseProduct(
      '<meta itemprop="name" content="Gift"><meta itemprop="price" content="12.50"><meta itemprop="priceCurrency" content="EUR"><meta itemprop="image" content="/gift.png">',
      "https://example.com",
    ),
    { title: "Gift", price: "12.50", image: "https://example.com/gift.png" },
  );
  assert.equal(
    parseProduct(
      '<script type="application/ld+json">{"@type":"Product","image":"https://127.0.0.1/secret"}</script>',
      "https://example.com",
    ).image,
    "",
  );
});

test("access-denied and browser-verification pages do not become products", () => {
  for (const title of [
    "403 Interdit | Joybuy",
    "Access denied",
    "Just a moment...",
    "Robot Check",
  ]) {
    assert.deepEqual(
      parseProduct(
        `<title>${title}</title><meta property="og:image" content="/logo.png">`,
        "https://www.joybuy.fr/dp/example",
      ),
      { title: "", price: "", image: "" },
    );
  }
});

test("Joybuy login redirects yield only an explicitly derived product name", () => {
  const { productTitleFromUrl } = require("../src/lib/product-preview.ts");
  const url =
    "https://www.joybuy.fr/dp/honor-%C3%A9couteurs-a-pro-grand-hautparleur/100741336?requestIdentity=flashSale";
  assert.equal(
    productTitleFromUrl(url),
    "honor écouteurs a pro grand hautparleur",
  );
  assert.deepEqual(
    parseProduct(
      '<title>Connectez-vous à votre compte | Joybuy</title><meta name="og:title" content="Joybuy">',
      "https://www.joybuy.fr/login?returnUrl=product",
    ),
    { title: "", price: "", image: "" },
  );
  assert.equal(
    productTitleFromUrl("https://joybuy.fr.example.com/dp/fake/123"),
    "",
  );
  assert.equal(productTitleFromUrl("https://www.joybuy.fr/dp/100741336"), "");
  assert.equal(
    productTitleFromUrl("https://www.joybuy.fr/dp/%E0%A4%A/100741336"),
    "",
  );
});

test("merchant product links provide a name when the page is unavailable", () => {
  const { productTitleFromUrl } = require("../src/lib/product-preview.ts");
  for (const [url, title] of [
    ["https://www.vinted.fr/items/123456-robe-en-lin", "robe en lin"],
    [
      "https://www.e.leclerc/fp/bouquet-de-fleurs-5702016913767",
      "bouquet de fleurs",
    ],
    [
      "https://www.lidl.fr/p/boites-de-jeux-en-bois/p100395118",
      "boites de jeux en bois",
    ],
    ["https://www.carrefour.fr/p/lego-paris-5702016368314", "lego paris"],
    ["https://fr.shein.com/Robe-En-Lin-p-123456.html", "Robe En Lin"],
    [
      "https://www.temu.com/fr/sac-en-coton-g-601123456789.html",
      "sac en coton",
    ],
    [
      "https://www.cdiscount.com/juniors/jeux/lego-bouquet/f-12083-lego10280.html",
      "lego bouquet",
    ],
  ])
    assert.equal(productTitleFromUrl(url), title, url);
  for (const url of [
    "https://www.booking.com/hotel/fr/example.html",
    "https://vinted.fr.example.com/items/123456-faux-produit",
    "https://www.vinted.fr/catalog/123456-robes",
    "https://www.temu.com/fr/g-601123456789.html",
    "https://www.leboncoin.fr/ad/jeux_jouets/123456",
    "https://www.carrefour.fr/p/5702016368314",
  ])
    assert.equal(productTitleFromUrl(url), "", url);
});

test("mobile Shein links retain the product name but challenge pages supply no fields", () => {
  const { productTitleFromUrl } = require("../src/lib/product-preview.ts");
  assert.equal(
    productTitleFromUrl(
      "https://m.shein.com/fr/Calvaya-Plus-Size-Casual-Sweater-p-223396894.html?mallCode=1",
    ),
    "Calvaya Plus Size Casual Sweater",
  );
  assert.deepEqual(
    parseProduct(
      "<title>SHEIN.com is mainly design and produce fashion clothing</title>",
      "https://m.shein.com/fr/risk/challenge?captcha_type=909",
    ),
    { title: "", price: "", image: "" },
  );
});

test("Temu shared product images are read only from validated product and CDN URLs", () => {
  const { productImageFromUrl } = require("../src/lib/product-preview.ts");
  const image = "https://img.kwcdn.com/product/fancy/product.jpg";
  const url = `https://www.temu.com/fr/goods.html?goods_id=606289073687165&share_img=${encodeURIComponent(image)}`;
  assert.equal(productImageFromUrl(url), image);
  for (const invalid of [
    url.replace("www.temu.com", "temu.com.example.com"),
    url.replace("goods.html", "login.html"),
    url.replace("goods_id=606289073687165", "goods_id="),
    url.replace(
      encodeURIComponent(image),
      encodeURIComponent("https://127.0.0.1/secret"),
    ),
    url.replace(
      encodeURIComponent(image),
      encodeURIComponent("https://img.kwcdn.com.example.com/logo.jpg"),
    ),
  ])
    assert.equal(productImageFromUrl(invalid), "");
});

test("Leboncoin primary ad data supplies fields without using recommended ads", () => {
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    {
      props: {
        pageProps: {
          ad: {
            subject: "Vélo enfant",
            price: [45],
            images: { urls_large: ["https://img.leboncoin.fr/velo.jpg"] },
          },
          recommendations: [{ subject: "Autre vélo", price: [999] }],
        },
      },
    },
  )}</script>`;
  assert.deepEqual(
    parseProduct(html, "https://www.leboncoin.fr/ad/velos/123456"),
    {
      title: "Vélo enfant",
      price: "45.00",
      image: "https://img.leboncoin.fr/velo.jpg",
    },
  );
  assert.equal(
    parseProduct(html, "https://leboncoin.fr.example.com/ad/velos/123456")
      .price,
    "",
  );
});

test("structured offers handle nested prices and aggregate offers", () => {
  for (const offers of [
    { "@type": "AggregateOffer", lowPrice: "24.90", priceCurrency: "EUR" },
    {
      "@type": "Offer",
      priceSpecification: { price: "24.90", priceCurrency: "EUR" },
    },
  ]) {
    assert.equal(
      parseProduct(
        `<script type="application/ld+json">${JSON.stringify({
          "@type": "Product",
          name: "Cadeau",
          offers,
        })}</script>`,
        "https://www.e.leclerc/fp/cadeau-1234567890123",
      ).price,
      "24.90",
    );
  }
});

test("Vinted item data preserves currency and product photos", () => {
  const page = (currency) =>
    `<script type="application/json" id="__NEXT_DATA__">${JSON.stringify({
      props: {
        pageProps: {
          item: {
            title: "Robe en lin",
            price: { amount: "12.50", currency },
            photos: [{ full_size_url: "https://images.vinted.net/robe.jpg" }],
          },
        },
      },
    })}</script>`;
  assert.deepEqual(
    parseProduct(page("EUR"), "https://www.vinted.fr/items/123456-robe-en-lin"),
    {
      title: "Robe en lin",
      price: "12.50",
      image: "https://images.vinted.net/robe.jpg",
    },
  );
  assert.equal(
    parseProduct(page("USD"), "https://www.vinted.fr/items/123456-robe-en-lin")
      .price,
    "",
  );
});

test("Cdiscount lowercase product schema supplies the actual EUR offer", () => {
  assert.deepEqual(
    parseProduct(
      `<script type="application/ld+json">${JSON.stringify({
        "@type": "product",
        name: "LEGO Botanicals 10342",
        image: "https://www.cdiscount.com/product.jpg",
        offers: { "@type": "Offer", price: 42.99, priceCurrency: "EUR" },
      })}</script>`,
      "https://www.cdiscount.com/juniors/lego/f-12083-lego10342.html",
    ),
    {
      title: "LEGO Botanicals 10342",
      price: "42.99",
      image: "https://www.cdiscount.com/product.jpg",
    },
  );
});

test("login.html redirects never supply storefront titles or logos", () => {
  assert.deepEqual(
    parseProduct(
      '<title>Temu France | &amp;</title><meta property="og:image" content="/logo.png">',
      "https://www.temu.com/login.html?from=goods.html",
    ),
    { title: "", price: "", image: "" },
  );
});

test("rendered fallback retrieves a primary product through the fixed service endpoint", async (t) => {
  const {
    readRenderedProduct,
  } = require("../src/lib/product-preview-rendered.ts");
  const url = "https://www.leboncoin.fr/ad/accessoires_informatique/3261483687";
  t.mock.method(global, "fetch", async (endpoint, options) => {
    assert.equal(endpoint, "https://api.firecrawl.dev/v2/scrape");
    assert.equal(options.redirect, "error");
    const body = JSON.parse(options.body);
    assert.equal(body.url, url);
    assert.deepEqual(body.formats, ["rawHtml"]);
    return Response.json({
      success: true,
      data: {
        metadata: { url },
        rawHtml:
          '<script type="application/ld+json">{"@type":"Product","name":"Câble adaptateur","image":"https://img.leboncoin.fr/cable.jpg","offers":{"price":8,"priceCurrency":"EUR"}}</script>',
      },
    });
  });
  assert.deepEqual(await readRenderedProduct(url), {
    title: "Câble adaptateur",
    price: "8.00",
    image: "https://img.leboncoin.fr/cable.jpg",
  });
});

test("rendered fallback does not send unsupported or unsafe destinations to the service", async (t) => {
  const {
    readRenderedProduct,
  } = require("../src/lib/product-preview-rendered.ts");
  const fetch = t.mock.method(global, "fetch", () => {
    throw new Error("Unexpected network request");
  });
  for (const url of [
    "https://127.0.0.1",
    "https://leboncoin.fr.example.com/ad/123",
    "https://www.booking.com/hotel/fr/example.html",
    "https://example.com/product",
  ]) {
    assert.equal(await readRenderedProduct(url), null);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test("rendered service failures and unsafe redirects leave the direct preview usable", async (t) => {
  const {
    readRenderedProduct,
  } = require("../src/lib/product-preview-rendered.ts");
  const url = "https://www.leboncoin.fr/ad/accessoires_informatique/3261483687";
  const responses = [
    Response.json({ error: "rate limit" }, { status: 429 }),
    Response.json({
      success: true,
      data: {
        rawHtml: "<title>Secret</title>",
        metadata: { url: "https://127.0.0.1/secret" },
      },
    }),
    Response.json({
      success: true,
      data: {
        rawHtml: "<title>Login</title>",
        metadata: { url: "https://www.temu.com/login.html" },
      },
    }),
  ];
  t.mock.method(global, "fetch", async () => responses.shift());
  for (let i = 0; i < 3; i++)
    assert.equal(await readRenderedProduct(url), null);
});

test("rendered storefronts with no product price and photo are not imported", async (t) => {
  const {
    readRenderedProduct,
  } = require("../src/lib/product-preview-rendered.ts");
  t.mock.method(global, "fetch", async () =>
    Response.json({
      success: true,
      data: {
        metadata: { url: "https://fr.shein.com/" },
        rawHtml:
          "<title>Women’s &amp; Men’s Clothing, Shop Online Fashion | SHEIN</title>",
      },
    }),
  );
  assert.equal(
    await readRenderedProduct(
      "https://m.shein.com/fr/sweater-p-223396894.html",
    ),
    null,
  );
});

test("complete direct previews do not call the rendered service", async (t) => {
  const { readProductPage } = require("../src/lib/product-preview-rendered.ts");
  const preview = require("../src/lib/product-preview.ts");
  const url =
    "https://www.vinted.fr/items/9488559497-persona-5-strikers-para-a-ps5";
  t.mock.method(preview, "readPublicResource", async () => ({
    url,
    bytes: Buffer.from(
      '<script type="application/ld+json">{"@type":"Product","name":"Persona 5 Strikers","image":"https://images.vinted.net/persona.webp","offers":{"price":12,"priceCurrency":"EUR"}}</script>',
    ),
  }));
  const fetch = t.mock.method(global, "fetch", () => {
    throw new Error("Unexpected service call");
  });
  assert.equal((await readProductPage(url)).data.price, "12.00");
  assert.equal(fetch.mock.callCount(), 0);
});

test("a blocked direct request falls back to a rendered product", async (t) => {
  const { readProductPage } = require("../src/lib/product-preview-rendered.ts");
  const preview = require("../src/lib/product-preview.ts");
  const url = "https://www.leboncoin.fr/ad/accessoires_informatique/3261483687";
  t.mock.method(preview, "readPublicResource", async () => {
    throw new Error("unsupported");
  });
  t.mock.method(global, "fetch", async (_endpoint, options) => {
    assert.equal(JSON.parse(options.body).url, url);
    return Response.json({
      success: true,
      data: {
        metadata: { url },
        rawHtml:
          '<script type="application/ld+json">{"@type":"Product","name":"Câble","image":"https://img.leboncoin.fr/cable.jpg","offers":{"price":8,"priceCurrency":"EUR"}}</script>',
      },
    });
  });
  assert.deepEqual((await readProductPage(url)).data, {
    title: "Câble",
    price: "8.00",
    image: "https://img.leboncoin.fr/cable.jpg",
  });
});

test("merchant photos are downloaded without the rejected preview User-Agent", async (t) => {
  const { PassThrough } = require("node:stream");
  const { EventEmitter } = require("node:events");
  t.mock.method(require("node:dns/promises"), "lookup", async () => [
    { address: "8.8.8.8", family: 4 },
  ]);
  t.mock.method(require("node:https"), "request", (_url, options, respond) => {
    const request = new EventEmitter();
    request.end = () => {
      const response = new PassThrough();
      response.statusCode = options.headers["User-Agent"] ? 403 : 200;
      response.headers = { "content-type": "image/jpeg;charset=UTF-8" };
      respond(response);
      response.end(Buffer.from("merchant image"));
      request.emit("close");
    };
    return request;
  });
  const result = await readPublicResource(
    "https://media.carrefour.fr/product.jpeg",
    1024,
    "image",
  );
  assert.equal(result.bytes.toString(), "merchant image");
});
