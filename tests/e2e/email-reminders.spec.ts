import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
for (const [locale, messages] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: email reminders opt in, lead time and disabling persist`, async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "desktop",
      "Settings persistence does not depend on viewport",
    );
    await page.goto(`/${locale}/register`);
    await page.locator('input[name="name"]').fill("Reminder user");
    await page
      .locator('input[name="email"]')
      .fill(
        `reminders-${locale}-${info.project.name}-${Date.now()}@example.test`,
      );
    await page.locator('input[name="password"]').fill("Browser-test-2026!");
    await page
      .getByRole("button", { name: messages.auth.signUp, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
    await page.goto(`/${locale}/dashboard/profile`);
    const checkbox = page.getByRole("checkbox", {
      name: messages.emailReminders.enabled,
    });
    const days = page.getByLabel(messages.emailReminders.leadTime, {
      exact: true,
    });
    const form = page.locator("form").filter({ has: checkbox });
    await expect(checkbox).not.toBeChecked();
    await expect(days).toHaveValue("3");
    await page.locator('select[name="locale"]').selectOption(locale);
    await checkbox.check();
    await days.selectOption("7");
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname.endsWith("/dashboard/profile") &&
          response.ok(),
      ),
      form
        .getByRole("button", { name: messages.common.save, exact: true })
        .click(),
    ]);
    await page.reload();
    await expect(checkbox).toBeChecked();
    await expect(days).toHaveValue("7");
    await checkbox.uncheck();
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname.endsWith("/dashboard/profile") &&
          response.ok(),
      ),
      form
        .getByRole("button", { name: messages.common.save, exact: true })
        .click(),
    ]);
    await page.reload();
    await expect(checkbox).not.toBeChecked();
    await expect(days).toHaveValue("7");
  });
}
