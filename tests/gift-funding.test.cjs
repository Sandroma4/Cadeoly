const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function render(props) {
  const exports = {};
  const source = ts.transpileModule(
    fs.readFileSync("src/components/wishlist/GiftFunding.tsx", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  vm.runInNewContext(source, {
    exports,
    require: (name) =>
      name === "next-intl"
        ? {
            useLocale: () => "en",
            useTranslations: () => (key, values) =>
              key === "progress"
                ? `${values.total} of ${values.target}`
                : "Fully funded",
          }
        : require(name),
    Intl,
  });
  return renderToStaticMarkup(React.createElement(exports.GiftFunding, props));
}

test("funding progress uses the gift currency and a bounded accessible value", () => {
  const html = render({ total: 12500, target: 10000, currency: "USD" });
  assert.match(html, /\$125\.00 of \$100\.00/);
  assert.match(html, /value="10000" max="10000"/);
  assert.match(html, /Fully funded/);
  assert.doesNotMatch(html, /€/);
});

test("funding without a positive target renders no misleading progress", () => {
  assert.equal(render({ total: 100, target: 0, currency: "EUR" }), "");
  assert.equal(render({ total: 100, target: null, currency: "EUR" }), "");
  assert.match(
    render({ total: 0, target: 5000, currency: "EUR" }),
    /value="0"/,
  );
});
