import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

for (const [locale, messages] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: private gift budgets persist and stay separate by currency`, async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "desktop",
      "Budget persistence does not depend on viewport",
    );
    const t = messages.giftBudget;
    await page.goto(`/${locale}/register`);
    await page.locator('input[name="name"]').fill("Budget user");
    await page
      .locator('input[name="email"]')
      .fill(`budget-${locale}-${info.project.name}-${Date.now()}@example.test`);
    await page.locator('input[name="password"]').fill("Browser-test-2026!");
    await page
      .getByRole("button", { name: messages.auth.signUp, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
    await page.goto(`/${locale}/dashboard/reservations`);
    await expect(
      page.getByRole("heading", { name: t.title, exact: true }),
    ).toBeVisible();
    await page.getByLabel(t.amount, { exact: true }).fill("123.45");
    await page.getByRole("button", { name: t.save, exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: t.saved }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(t.amount, { exact: true })).toHaveValue(
      "123.45",
    );
    await page.getByLabel(t.currency, { exact: true }).selectOption("USD");
    await expect(page.getByLabel(t.amount, { exact: true })).toHaveValue("");
    await page.getByLabel(t.amount, { exact: true }).fill("50");
    await page.getByRole("button", { name: t.save, exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: t.saved }),
    ).toBeVisible();
    await page.getByLabel(t.currency, { exact: true }).selectOption("EUR");
    await expect(page.getByLabel(t.amount, { exact: true })).toHaveValue(
      "123.45",
    );
    await page.getByRole("button", { name: t.remove, exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: t.removed }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(t.amount, { exact: true })).toHaveValue("");
    await page.getByLabel(t.currency, { exact: true }).selectOption("USD");
    await expect(page.getByLabel(t.amount, { exact: true })).toHaveValue(
      "50.00",
    );
  });
}
