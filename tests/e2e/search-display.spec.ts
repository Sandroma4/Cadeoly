import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

for (const [locale, t] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: global search opens gifts and display choice survives reload`, async ({
    page,
  }, info) => {
    await page.goto(`/${locale}/register`);
    await page.locator('input[name="name"]').fill("Search owner");
    await page
      .locator('input[name="email"]')
      .fill(`search-${locale}-${info.project.name}-${Date.now()}@example.test`);
    await page.locator('input[name="password"]').fill("Browser-test-2026!");
    await page
      .getByRole("button", { name: t.auth.signUp, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
    expect(
      (
        await page.request.post("/api/account-import", {
          data: {
            confirm: true,
            document: {
              version: 1,
              lists: [
                {
                  name: "Winter wishes",
                  gifts: [
                    { title: "Winter scarf", description: "Soft wool" },
                    { title: "Summer book" },
                  ],
                },
              ],
            },
          },
        })
      ).status(),
    ).toBe(200);
    if (info.project.name === "mobile") {
      await page
        .locator(`summary[aria-label="${t.dashboard.displaySettings}"]`)
        .click();
      await page
        .locator("details[open]")
        .getByRole("link", { name: t.globalSearch.title, exact: true })
        .click();
    } else await page.locator(".dashboard-search-link").click();
    await expect(
      page.getByRole("heading", { name: t.globalSearch.title, exact: true }),
    ).toBeVisible();
    await page.getByLabel(t.globalSearch.query, { exact: true }).fill("Winter");
    await page
      .getByRole("button", { name: t.globalSearch.submit, exact: true })
      .click();
    await expect(page).toHaveURL(/q=Winter/);
    await expect(
      page.getByRole("link", { name: "Winter wishes", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Winter scarf", exact: true }).click();
    await expect(page.locator(".gift-card")).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "Winter scarf", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: t.giftView.compact, exact: true })
      .click();
    await expect(page.locator(".gift-grid")).toHaveClass(/gift-grid-compact/);
    await expect(page.locator(".gift-card .gift-media")).toBeHidden();
    await page.reload();
    await expect(
      page.getByRole("button", { name: t.giftView.compact, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".gift-card")).toBeVisible();
    if (locale === "fr") {
      await page.screenshot({
        path: info.outputPath("compact-view.png"),
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: t.common.edit, exact: true })
      .click();
    await expect(page.locator(".gift-editor")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: t.common.cancel, exact: true })
      .click();
    await page
      .getByRole("button", { name: t.giftView.photos, exact: true })
      .click();
    await expect(page.locator(".gift-card .gift-media")).toBeVisible();
  });
}
