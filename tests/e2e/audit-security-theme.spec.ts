import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("security headers allow hydration and block an injected inline script", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const state = window as typeof window & { auditViolations: string[] };
    state.auditViolations = [];
    document.addEventListener("securitypolicyviolation", (event) =>
      state.auditViolations.push(event.effectiveDirective),
    );
  });
  await page.route("**/fr/login", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      "</body>",
      "<script>window.injected = true</script></body>",
    );
    await route.fulfill({ response, body });
  });
  const response = await page.goto("/fr/login");
  const headers = response!.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["strict-transport-security"]).toContain("includeSubDomains");
  expect(headers["content-security-policy"]).toContain("'strict-dynamic'");
  const nonce = await page
    .locator("script[nonce]")
    .first()
    .evaluate((script) => (script as HTMLScriptElement).nonce);
  expect(nonce).toBeTruthy();
  expect(headers["content-security-policy"]).toContain(`'nonce-${nonce}'`);
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { auditViolations: string[] })
            .auditViolations,
      ),
    )
    .toContain("script-src-elem");
  expect(
    await page.evaluate(() =>
      Boolean((window as typeof window & { injected?: boolean }).injected),
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
  const worker = await page.request.get("/sw.js");
  expect(worker.headers()["content-security-policy"]).toBe(
    "default-src 'self'; script-src 'self'",
  );
});

test("system theme updates live and saved legacy preferences remain usable", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "wishi-theme", value: "dark", url: "http://127.0.0.1:3107" },
  ]);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/fr/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(21, 18, 27)",
  );
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "system";
  });
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(252, 249, 245)",
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(21, 18, 27)",
  );
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(252, 249, 245)",
  );
  await context.addCookies([
    { name: "cadeoly-theme", value: "light", url: "http://127.0.0.1:3107" },
  ]);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const shadow = await page.locator("body").evaluate((body) => {
    const card = document.createElement("div");
    card.style.boxShadow = "var(--shadow-md)";
    body.append(card);
    const value = getComputedStyle(card).boxShadow;
    card.remove();
    return value;
  });
  expect(shadow).not.toBe("none");
  // Exercise the fallback even though the current test browser supports light-dark.
  const legacyTokens = readFileSync(
    "src/app/styles/tokens.css",
    "utf8",
  ).replace("@supports not (color: light-dark(white, black))", "@media all");
  await page.addStyleTag({ content: legacyTokens });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "system";
  });
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(21, 18, 27)",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(252, 249, 245)",
  );
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(21, 18, 27)",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
