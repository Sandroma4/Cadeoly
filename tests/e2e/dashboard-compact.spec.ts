import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

for (const [locale, m] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: dashboard prioritizes lists and compact first steps`, async ({
    page,
  }, info) => {
    test.skip(locale === "en" && info.project.name === "mobile");
    await page.goto(`/${locale}/register`);
    await page.locator('[name="name"]').fill("Compact");
    await page
      .locator('[name="email"]')
      .fill(`compact-${locale}-${Date.now()}@example.test`);
    await page.locator('[name="password"]').fill("Browser-test-2026!");
    await page
      .getByRole("button", { name: m.auth.signUp, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
    await page
      .getByRole("dialog")
      .getByRole("button", { name: m.tutorial.skip, exact: true })
      .click();
    const steps = page.locator("details").filter({
      has: page.getByText(m.onboarding.list, { exact: true }),
    });
    await expect(steps).toBeVisible();
    await expect(steps).not.toHaveAttribute("open", "");
    await expect(page.locator(".reminder-panel")).toHaveCount(0);
    const lists = page.getByRole("heading", {
      name: m.dashboard.myWishlists,
      exact: true,
    });
    const listBounds = await lists.boundingBox();
    const stepBounds = await steps.boundingBox();
    expect(listBounds!.y).toBeLessThan(stepBounds!.y);
    await steps.locator("summary").click();
    await expect(steps.getByRole("link")).toHaveCount(1);
    await steps.getByRole("button", { name: m.onboarding.hide }).click();
    await expect(steps).toBeHidden();
    await page.reload();
    await expect(steps).toBeHidden();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await steps.locator("summary").click();
    await steps.getByRole("link").click();
    await page.locator('input[name="name"]').fill("First list");
    await page
      .getByRole("button", { name: m.common.save, exact: true })
      .click();
    await expect(page).toHaveURL(/dashboard\/wishlists\/(?!create$)[^/]+$/);
    await page.goto(`/${locale}/dashboard`);
    await expect(
      page.getByText(m.onboarding.firstGift, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator(".reminder-panel")).toHaveCount(0);
    await expect(
      page
        .locator('[class*="listsCard"]')
        .getByRole("link", { name: m.wishlist.addItem, exact: true }),
    ).toHaveCount(1);
    const response = await page.request.post("/api/account-import", {
      data: {
        confirm: true,
        document: {
          version: 1,
          lists: [{ name: "A wish", gifts: [{ title: "Book" }] }],
        },
      },
    });
    expect(response.status()).toBe(200);
    await page.reload();
    await expect(
      page.getByText(m.onboarding.firstGift, {
        exact: true,
      }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `test-results/dashboard-${locale}-${info.project.name}.png`,
      fullPage: true,
    });
    if (info.project.name === "mobile") {
      const card = page.locator('[class*="listsCard"]');
      const entries = card.locator("li");
      await expect(entries).toHaveCount(2);
      for (const entry of await entries.all()) {
        await expect(entry).toHaveCSS("border-top-width", "1px");
        await expect(entry.getByRole("link").first()).toHaveCSS(
          "min-height",
          "44px",
        );
      }
      await expect(card.getByRole("heading")).toHaveCSS("font-weight", "700");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(page.viewportSize()!.width);
    }
  });
}
