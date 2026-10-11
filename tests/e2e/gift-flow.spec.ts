import { test, expect, type Page } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

for (const [locale, text] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: signup keeps the destination and shared gifts stay a surprise`, async ({
    page,
    browser,
  }, testInfo) => {
    const suffix = `${testInfo.project.name}-${locale}-${Date.now()}`;
    const password = "Browser-test-2026!";
    async function register(target: Page, role: string, next: string) {
      await target.goto(`/${locale}/register?next=${encodeURIComponent(next)}`);
      await target.locator('input[name="name"]').fill(role);
      await target
        .locator('input[name="email"]')
        .fill(`${role}-${suffix}@example.test`);
      await target.locator('input[name="password"]').fill(password);
      await target
        .locator("form")
        .getByRole("button", { name: text.auth.signUp, exact: true })
        .click();
      await expect(target).toHaveURL(new RegExp(`${next}$`));
      if (next.includes("/dashboard")) {
        const tutorial = target.getByRole("dialog");
        await expect(tutorial).toBeVisible();
        await tutorial
          .getByRole("button", { name: text.tutorial.skip, exact: true })
          .click();
        await expect(tutorial).not.toBeVisible();
      }
    }
    const createPath = `/${locale}/dashboard/wishlists/create`;
    await register(page, "Owner", `/${locale}/dashboard`);
    if (testInfo.project.name === "mobile")
      await page
        .locator(`summary[aria-label="${text.dashboard.displaySettings}"]`)
        .click();
    await page
      .getByRole("button", { name: text.theme.dark, exact: true })
      .click();
    await page.reload();
    if (testInfo.project.name === "mobile")
      await page
        .locator(`summary[aria-label="${text.dashboard.displaySettings}"]`)
        .click();
    await expect(
      page.getByRole("button", { name: text.theme.dark, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.goto(createPath);
    await expect(page.locator('select[name="visibility"]')).toHaveValue(
      "PRIVATE",
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    if (testInfo.project.name === "mobile") {
      await expect(
        page.locator(`summary[aria-label="${text.dashboard.displaySettings}"]`),
      ).not.toBeVisible();
    }
    await page.locator('input[name="name"]').fill(`Gifts ${suffix}`);
    await page.locator('select[name="visibility"]').selectOption("LINK");
    await page
      .getByRole("button", { name: text.common.save, exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/wishlists\/[^/]+$/);
    const ownerURL = page.url();
    await page
      .getByRole("button", { name: text.wishlist.addItem, exact: true })
      .click();
    await page
      .getByRole("button", { name: new RegExp(text.uiFlow.manual) })
      .first()
      .click();
    await page.locator('input[name="title"]').fill("Birthday book");
    await page
      .getByRole("button", { name: text.uiFlow.reviewGift, exact: true })
      .click();
    await page
      .getByRole("button", { name: text.uiFlow.addToList, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Birthday book", exact: true }),
    ).toBeVisible();
    if (testInfo.project.name === "mobile") {
      await page.reload();
      // The list's display and filtering controls can fill a mobile viewport.
      await page
        .getByRole("heading", { name: "Birthday book", exact: true })
        .scrollIntoViewIfNeeded();
      await expect(
        page.getByRole("heading", { name: "Birthday book", exact: true }),
      ).toBeInViewport();
      await expect(
        page.locator(`summary[aria-label="${text.dashboard.displaySettings}"]`),
      ).not.toBeVisible();
    }
    await page
      .getByRole("button", { name: text.wishlist.createShare, exact: true })
      .click();
    const shared = page.locator('#list-share a[href*="/share/"]');
    await expect(shared).toHaveAttribute("href", /\/share\/[a-f0-9]{64}$/);
    const href = (await shared.getAttribute("href"))!;
    page.once("dialog", (dialog) => dialog.dismiss());
    await page
      .getByRole("button", {
        name: locale === "fr" ? "Renouveler le lien" : "Renew link",
        exact: true,
      })
      .click();
    await expect(shared).toHaveAttribute("href", href);
    const guest = await browser.newContext({
      baseURL: "http://127.0.0.1:3107",
      viewport: page.viewportSize(),
    });
    try {
      const giver = await guest.newPage();
      await giver.goto(href);
      await expect(
        giver.getByRole("link", { name: text.publicList.home, exact: true }),
      ).toBeVisible();
      await expect(
        giver.getByRole("heading", { name: "Birthday book", exact: true }),
      ).toBeVisible();
      await expect(
        giver.getByRole("button", { name: text.wishlist.reserve, exact: true }),
      ).toHaveCount(0);
      await expect(giver.locator(".result-count")).toHaveText(
        locale === "fr" ? "1 cadeau affiché sur 1" : "1 gift shown of 1",
      );
      await register(giver, "Giver", href);
      await giver
        .getByRole("button", { name: text.wishlist.reserve, exact: true })
        .click();
      await expect(
        giver.getByRole("button", {
          name: text.wishlist.cancelReservation,
          exact: true,
        }),
      ).toBeVisible();
      await page.goto(ownerURL);
      await expect(
        page.getByRole("button", {
          name: text.wishlist.cancelReservation,
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(
        page.getByText(text.wishlist.reserved, { exact: true }),
      ).toHaveCount(0);
      await giver
        .getByRole("button", {
          name: text.wishlist.cancelReservation,
          exact: true,
        })
        .click();
      await expect(
        giver.getByRole("button", { name: text.wishlist.reserve, exact: true }),
      ).toBeVisible();
    } finally {
      await guest.close();
    }
  });
}
