import { test, expect } from "@playwright/test";

for (const [locale, label] of [
  ["fr", "Installer Cadéoly"],
  ["en", "Install Cadéoly"],
] as const) {
  test(`${locale}: installation is available without an account and hidden after installation`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    const help = page.locator(".install-app-help");
    await expect(help.locator("summary")).toHaveText(label);
    await help.locator("summary").click();
    await expect(help.locator("p")).toContainText("iPhone");
    await expect(help.locator("p")).toContainText("Android");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    // Native install dialogs cannot be automated; exercise the browser event contract.
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(event, {
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: "accepted" }),
      });
      window.dispatchEvent(event);
    });
    await page.getByRole("button", { name: label }).click();
    await expect(
      page.locator(".install-app-button, .install-app-help"),
    ).toHaveCount(0);
  });

  test(`${locale}: production worker provides the localized offline fallback`, async ({
    page,
    context,
  }) => {
    await page.goto(`/${locale}`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => resolve(),
            { once: true },
          );
        });
      }
    });
    await context.setOffline(true);
    try {
      await page.goto(`/${locale}/login`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        locale === "fr" ? "Tu es hors connexion" : "You are offline",
      );
      await expect(page.getByRole("link")).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });
}

test("install metadata and icons are served publicly", async ({
  page,
  request,
}) => {
  await page.goto("/fr");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#6543be",
  );
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.scope).toBe("/");
  for (const icon of manifest.icons) {
    const asset = await request.get(icon.src);
    expect(asset.ok()).toBe(true);
    expect(asset.headers()["content-type"]).toContain("image/png");
  }
  const appleIcon = await page
    .locator('link[rel="apple-touch-icon"]')
    .getAttribute("href");
  expect(appleIcon).toBeTruthy();
  expect((await request.get(appleIcon!)).ok()).toBe(true);
});
