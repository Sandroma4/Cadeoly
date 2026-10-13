import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

for (const [locale, t] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: gift ideas empty state and compact filters`, async ({
    page,
  }, info) => {
    await page.goto(`/${locale}/register`);
    await page.locator('input[name="name"]').fill("Ideas layout");
    await page
      .locator('input[name="email"]')
      .fill(`ideas-${locale}-${info.project.name}-${Date.now()}@example.test`);
    await page.locator('input[name="password"]').fill("Browser-test-2026!");
    await page
      .getByRole("button", { name: t.auth.signUp, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
    await page
      .getByRole("button", { name: t.tutorial.skip, exact: true })
      .click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await page.goto(`/${locale}/dashboard/gift-ideas`);
    await expect(
      page.getByRole("heading", { name: t.convenience.ideasEmpty }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: t.convenience.ideasFamilyAction }),
    ).toHaveAttribute("href", `/${locale}/dashboard/family`);
    await expect(page.locator(".gift-summary")).toHaveCount(0);
    await expect(page.locator(".quick-budget-filters")).toHaveCount(0);
    const search = await page.getByRole("searchbox").boundingBox();
    const filters = await page.locator(".gift-ideas-filter-card").boundingBox();
    expect(search!.y + search!.height).toBeLessThan(filters!.y);
    await page.locator(".gift-filter-panel > summary").click();
    await expect(page.locator('input[type="number"]')).toHaveCount(0);
    await expect(
      page.getByRole("option", {
        name: t.giftSearch.quickPriority,
        exact: true,
      }),
    ).toHaveCount(1);
    await page.locator(".gift-filter-panel > summary").click();
    await page
      .getByRole("button", { name: t.giftView.compact, exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: t.giftView.compact, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
