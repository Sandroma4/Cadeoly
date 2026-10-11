import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
for (const [locale, m] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(
    locale + ": full list editor works as guest and signup unlocks sharing",
    async ({ page, browser }, info) => {
      test.skip(locale === "en" && info.project.name === "mobile");
      await page.goto("/" + locale + "/guest/lists/create");
      await expect(page).toHaveURL(new RegExp("/dashboard/wishlists/create$"));
      await page.locator('input[name="name"]').fill("Guest full interface");
      await expect(page.locator('select[name="visibility"]')).toHaveValue(
        "PRIVATE",
      );
      await expect(page.locator('option[value="LINK"]')).toBeDisabled();
      await page
        .getByRole("button", { name: m.common.save, exact: true })
        .click();
      await expect(page).toHaveURL(/dashboard\/wishlists\/(?!create$)[^/]+$/);
      const manage = page.url();
      const id = manage.split("/").pop()!;
      await expect(
        page.getByRole("heading", {
          name: "Guest full interface",
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: m.wishlist.addItem, exact: true })
        .click();
      await page
        .getByRole("button", { name: new RegExp(m.uiFlow.manual) })
        .first()
        .click();
      await page.locator('input[name="title"]').fill("Guest saved book");
      await page
        .getByRole("button", { name: m.uiFlow.reviewGift, exact: true })
        .click();
      await page
        .getByRole("button", { name: m.uiFlow.addToList, exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Guest saved book", exact: true }),
      ).toBeVisible();
      await expect(page.locator('#list-share a[href*="/share/"]')).toHaveCount(
        0,
      );
      await expect(
        page.getByRole("link", {
          name: m.guestAccount.unlockSharing,
          exact: true,
        }),
      ).toBeVisible();
      const other = await browser.newContext();
      try {
        const p = await other.newPage();
        await p.goto(manage);
        await expect(
          p.getByRole("heading", { name: m.common.notFound, exact: true }),
        ).toBeVisible();
      } finally {
        await other.close();
      }
      await page.goto("/" + locale + "/dashboard/wishlists");
      await page
        .getByRole("link", { name: "Guest full interface", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Guest saved book", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: m.guestAccount.unlockSharing, exact: true })
        .click();
      await page.locator('input[name="name"]').fill("Camille");
      await page
        .locator('input[name="email"]')
        .fill(
          "full-" +
            locale +
            "-" +
            info.project.name +
            "-" +
            Date.now() +
            "@example.test",
        );
      await page.locator('input[name="password"]').fill("Browser-test-2026!");
      await page
        .getByRole("button", { name: m.auth.signUp, exact: true })
        .click();
      await expect(page).toHaveURL(manage);
      await expect(page.getByRole("dialog")).toBeVisible();
      await page
        .getByRole("button", { name: m.tutorial.skip, exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Guest saved book", exact: true }),
      ).toBeVisible();
      await page.locator("#list-settings > summary").click();
      const settings = page.locator("#list-settings");
      await settings.locator('select[name="visibility"]').selectOption("LINK");
      await settings
        .getByRole("button", { name: m.common.save, exact: true })
        .click();
      await page
        .getByRole("button", { name: m.wishlist.createShare, exact: true })
        .click();
      const shared = page.locator('#list-share a[href*="/share/"]');
      await expect(shared).toHaveAttribute("href", /share\/[a-f0-9]{64}$/);
      const share = (await shared.getAttribute("href"))!;
      const visitor = await browser.newContext({
        baseURL: new URL(manage).origin,
      });
      try {
        const p = await visitor.newPage();
        await p.goto(share);
        await expect(
          p.getByRole("link", { name: m.guestAccount.reserve, exact: true }),
        ).toBeVisible();
        await expect(p.locator('input[name="firstName"]')).toHaveCount(0);
      } finally {
        await visitor.close();
      }
      const exported = await (
        await page.request.get("/api/account-export")
      ).json();
      expect(exported.lists.some((x: { id: string }) => x.id === id)).toBe(
        true,
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(page.viewportSize()!.width);
    },
  );
}
