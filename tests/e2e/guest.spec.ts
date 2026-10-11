import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
for (const [locale, m] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(
    locale + ": guest uses the full navigation and account gates",
    async ({ page }, info) => {
      test.skip(locale === "en" && info.project.name === "mobile");
      await page.goto("/" + locale + "/guest");
      await expect(page).toHaveURL(new RegExp("/" + locale + "/dashboard$"));
      await expect(
        page.getByRole("navigation", { name: m.dashboard.title, exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        m.guestAccount.guestName,
      );
      for (const feature of ["family", "events", "reservations"]) {
        await page
          .locator(`aside nav a[href="/${locale}/dashboard/${feature}"]`)
          .click();
        await expect(
          page.getByRole("heading", {
            name: m.guestAccount.requiredTitle,
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByRole("link", {
            name: m.guestAccount.createAccount,
            exact: true,
          }),
        ).toHaveAttribute("href", /register\?next=/);
      }
      await page.goto("/" + locale + "/dashboard/wishlists");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(page.viewportSize()!.width);
      expect(
        await (await page.request.get("/api/auth/session")).json(),
      ).toBeNull();
    },
  );
}
