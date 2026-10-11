const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript");
function helper(session) {
  const exports = {};
  const source = ts.transpileModule(
    fs.readFileSync("src/lib/action-auth.ts", "utf8"),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    },
  ).outputText;
  vm.runInNewContext(source, {
    exports,
    require: () => ({ auth: async () => session }),
  });
  return exports.withAuth;
}
test("unauthenticated actions return before running any operation", async () => {
  const run = helper(null);
  const result = await run(async () =>
    assert.fail("operation must not execute"),
  );
  assert.equal(result.error, "unauthorized");
});
test("authenticated actions receive the session identity and preserve errors", async () => {
  const run = helper({ user: { id: "verified-user" } });
  assert.equal(await run(async (userId) => userId), "verified-user");
  const error = new Error("database failure");
  await assert.rejects(
    run(async () => {
      throw error;
    }),
    (actual) => actual === error,
  );
});
