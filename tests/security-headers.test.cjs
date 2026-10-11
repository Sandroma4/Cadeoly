require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { contentSecurityPolicy } = require("../src/lib/security-headers.ts");

test("page CSP trusts only its request nonce and disables embedding and plugin content", () => {
  const policy = contentSecurityPolicy("request-specific");
  assert.ok(policy.includes("'nonce-request-specific' 'strict-dynamic'"));
  assert.ok(!policy.includes("script-src 'self' 'unsafe-inline'"));
  assert.ok(policy.includes("object-src 'none'"));
  assert.ok(policy.includes("frame-ancestors 'none'"));
  assert.ok(policy.includes("form-action 'self'"));
});

test("global headers protect API and public assets and preserve the service worker policy", async () => {
  const fs = require("node:fs"),
    vm = require("node:vm"),
    ts = require("typescript");
  const source = ts.transpileModule(fs.readFileSync("next.config.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    process: { env: { NODE_ENV: "production" }, cwd: process.cwd },
    require: (name) => {
      if (name === "next-intl/plugin")
        return { default: () => (config) => config };
      if (name === "./src/lib/security-headers")
        return { contentSecurityPolicy };
      return require(name);
    },
  });
  const rules = await exports.default.headers();
  const global = Object.fromEntries(
    rules[0].headers.map(({ key, value }) => [key, value]),
  );
  assert.equal(rules[0].source, "/:path*");
  assert.equal(global["X-Frame-Options"], "DENY");
  assert.equal(global["X-Content-Type-Options"], "nosniff");
  assert.ok(global["Strict-Transport-Security"].includes("includeSubDomains"));
  const worker = rules.find((rule) => rule.source === "/sw.js");
  assert.equal(
    worker.headers.find((header) => header.key === "Content-Security-Policy")
      .value,
    "default-src 'self'; script-src 'self'",
  );
  assert.equal(
    exports.default.experimental.serverActions.allowedOrigins,
    undefined,
    "same-origin protection remains the default",
  );
});
