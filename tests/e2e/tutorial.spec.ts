import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

for (const [locale, messages] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: tutorial can be skipped, replayed and completed once per account`, async ({
    page,
    browser,
  }, info) => {
    test.skip(
      locale === "en" && info.project.name === "mobile",
      "One mobile layout and both translations are covered",
    );
    const t = messages.tutorial;
    const email = `tutorial-${locale}-${info.project.name}-${Date.now()}@example.test`;
    await page.goto(`/${locale}/register`);
    await page.locator('input[name="name"]').fill("Tutorial user");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill("Browser-test-2026!");
    await page
      .getByRole("button", { name: messages.auth.signUp, exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: t.welcomeTitle }),
    ).toBeFocused();
    if (info.project.name === "mobile") {
      const box = await dialog.boundingBox();
      expect(box!.y + box!.height).toBeCloseTo(page.viewportSize()!.height, 0);
    }
    await dialog.getByRole("button", { name: t.skip, exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.reload();
    await expect(dialog).not.toBeVisible();

    // A fresh browser session proves completion lives on the account.
    const second = await browser.newContext();
    try {
      const returning = await second.newPage();
      await returning.goto(`/${locale}/login`);
      await returning.locator('input[name="email"]').fill(email);
      await returning
        .locator('input[name="password"]')
        .fill("Browser-test-2026!");
      await returning
        .getByRole("button", { name: messages.auth.signIn, exact: true })
        .click();
      await expect(returning).toHaveURL(new RegExp(`/${locale}/dashboard$`));
      await expect(returning.getByRole("dialog")).not.toBeVisible();
    } finally {
      await second.close();
    }

    await page
      .locator(`summary[aria-label="${messages.dashboard.displaySettings}"]`)
      .click();
    await page.getByRole("button", { name: t.replay, exact: true }).click();
    await expect(
      dialog.getByRole("heading", { name: t.welcomeTitle }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: t.discover, exact: true }).click();
    await expect(
      dialog.getByRole("heading", { name: t.listTitle }),
    ).toBeFocused();
    await dialog.getByRole("button", { name: t.back, exact: true }).click();
    await expect(
      dialog.getByRole("heading", { name: t.welcomeTitle }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: t.discover, exact: true }).click();
    await dialog.getByRole("button", { name: t.next, exact: true }).click();
    await expect(
      dialog.getByRole("heading", { name: t.shareTitle }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: t.next, exact: true }).click();
    await expect(
      dialog.getByRole("heading", { name: t.reserveTitle }),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: t.createList, exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/${locale}/dashboard/wishlists/create$`),
    );
    await expect(dialog).not.toBeVisible();
  });
}
