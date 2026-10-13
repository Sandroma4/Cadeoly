import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
for (const [locale, messages] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: email reminders autosave, preserve delay and disable correctly`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop");
    await page.goto(`/${locale}/register`);
    await page.locator('[name="name"]').fill("Reminder user");
    await page
      .locator('[name="email"]')
      .fill(`reminders-${locale}-${Date.now()}@example.test`);
    await page.locator('[name="password"]').fill("Browser-test-2026!");
    await page
      .getByRole("button", { name: messages.auth.signUp, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
    await page
      .getByRole("dialog")
      .getByRole("button", { name: messages.tutorial.skip, exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.goto(`/${locale}/dashboard/profile?section=preferences`);
    const toggle = page.getByRole("switch", {
      name: messages.emailReminders.title,
    });
    const days = page.getByLabel(messages.emailReminders.leadTime, {
      exact: true,
    });
    const status = page.locator("[data-profile-page] [role=status]");
    await expect(toggle).not.toBeChecked();
    await expect(days).toBeDisabled();
    await expect(days).toHaveValue("3");
    await page.locator('select[name="locale"]').selectOption(locale);
    await expect(status).toHaveText(messages.profileSettings.saved);
    await toggle.check();
    await expect(days).toBeEnabled();
    await expect(status).toHaveText(messages.profileSettings.saved);
    await days.selectOption("7");
    await expect(status).toHaveText(messages.profileSettings.saved);
    await page.reload();
    await expect(toggle).toBeChecked();
    await expect(days).toHaveValue("7");
    await toggle.uncheck();
    await expect(status).toHaveText(messages.profileSettings.saved);
    await page.reload();
    await expect(toggle).not.toBeChecked();
    await expect(days).toBeDisabled();
    await expect(days).toHaveValue("7");
  });
}
