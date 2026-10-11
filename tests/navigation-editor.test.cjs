require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { returnPath } = require("../src/lib/return-path.ts");

test("login retains known localized dashboard destinations and supported queries", () => {
  for (const path of [
    "/en/dashboard/profile",
    "/fr/dashboard/wishlists?view=archived",
    "/en/dashboard/wishlists/list_1?from=archived&preview=1&page=2&q=caf%C3%A9&sort=priceAsc&priority=HIGH&status=available&maxPrice=50",
    "/fr/dashboard/wishlists/create?eventId=event-1&url=https%3A%2F%2Fshop.test%2Fbook&title=Book",
    "/fr/dashboard/events?period=past",
    "/en/dashboard/events/event-1",
    "/fr/dashboard/family",
    "/en/dashboard/reservations",
    "/fr/dashboard/gift-ideas",
    "/en/dashboard/feedback",
  ])
    assert.equal(returnPath(path, "fr"), path);
});

test("return destinations reject external, encoded, normalized and unknown routes", () => {
  for (const path of [
    "https://evil.test/en/dashboard/profile",
    "https://local.invalid/en/dashboard/profile",
    "//evil.test/en/dashboard/profile",
    "\\\\evil.test\\en\\dashboard\\profile",
    "/en\\dashboard\\profile",
    "%2Fen%2Fdashboard%2Fprofile",
    "/%2fen/dashboard/profile",
    "/en/dashboard/%70rofile",
    "/en/dashboard/wishlists/../profile",
    "/en/dashboard/wishlists/%2e%2e/profile",
    "/en/dashboard/profile#evil",
    "/en/dashboard/profile?next=https://evil.test",
    "/en/dashboard/wishlists?unknown=value",
    "/en/dashboard/unknown",
    " /en/dashboard/profile",
    "/en/dashboard/pro\nfile",
  ])
    assert.equal(returnPath(path, "fr"), "/fr/dashboard", path);
});

test("registration still keeps quick capture and public invitation destinations", () => {
  for (const path of [
    "/fr/quick-add?url=https%3A%2F%2Fshop.test%2Fp&title=Book&text=Gift",
    "/en/invite/token-1",
    "/fr/share/token_1",
    "/en/lists/list-1",
  ])
    assert.equal(returnPath(path, "fr"), path);
});

test("middleware replaces a spoofed return path and preserves next-intl request headers", () => {
  const fs = require("node:fs"),
    vm = require("node:vm"),
    ts = require("typescript");
  const source = ts.transpileModule(fs.readFileSync("src/proxy.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const exports = {};
  const response = {
    headers: new Headers({
      "x-middleware-override-headers":
        "x-next-intl-locale,x-cadeoly-return-path",
      "x-middleware-request-x-next-intl-locale": "en",
      "x-middleware-request-x-cadeoly-return-path": "https://evil.test",
    }),
  };
  vm.runInNewContext(source, {
    exports,
    Buffer,
    crypto: require("node:crypto").webcrypto,
    require: (name) =>
      name === "next-intl/middleware"
        ? { default: () => () => response }
        : name === "./lib/security-headers"
          ? require("../src/lib/security-headers.ts")
          : { routing: {} },
  });
  const actual = exports.default({
    nextUrl: {
      pathname: "/en/dashboard/wishlists",
      search: "?view=archived",
    },
  });
  assert.equal(
    actual.headers.get("x-middleware-request-x-cadeoly-return-path"),
    "/en/dashboard/wishlists?view=archived",
  );
  assert.equal(
    actual.headers.get("x-middleware-request-x-next-intl-locale"),
    "en",
  );
  assert.equal(
    actual.headers.get("x-middleware-override-headers"),
    "x-next-intl-locale,x-cadeoly-return-path,content-security-policy,x-nonce",
  );
  const nonce = actual.headers.get("x-middleware-request-x-nonce");
  assert.match(nonce, /^[A-Za-z0-9+/]+=*$/);
  assert.ok(
    actual.headers.get("Content-Security-Policy").includes(`'nonce-${nonce}'`),
  );
  assert.equal(
    actual.headers.get("Content-Security-Policy"),
    actual.headers.get("x-middleware-request-content-security-policy"),
  );
});
