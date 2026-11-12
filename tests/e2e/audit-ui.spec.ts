import { test, expect } from "./fixtures";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

for (const [locale, t] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: compact onboarding, empty actions and family creation without leaving events`, async ({
    page,
  }, info) => {
    await page.goto(`/${locale}/register`);
    await page.locator('input[name="name"]').fill("Audit owner");
    await page
      .locator('input[name="email"]')
      .fill(`audit-${locale}-${info.project.name}-${Date.now()}@example.test`);
    await page.locator('input[name="password"]').fill("Browser-test-2026!");
    await page
      .getByRole("button", { name: t.auth.signUp, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
    // The onboarding disclosure now offers one next step: create a first list.
    const onboarding = page.locator("details", {
      has: page.locator('a[href$="/dashboard/wishlists/create"]'),
    });
    await expect(onboarding).not.toHaveAttribute("open", "");
    await onboarding.locator("summary").click();
    await expect(
      onboarding.getByRole("link", { name: new RegExp(t.onboarding.list) }),
    ).toBeVisible();
    await onboarding.locator("summary").click();
    await page.screenshot({
      path: `test-results/audit-home-${info.project.name}-${locale}.png`,
      fullPage: true,
    });
    await page.goto(`/${locale}/dashboard/wishlists`);
    await expect(
      page.getByRole("link", { name: t.wishlist.createFirst }),
    ).toHaveClass(/primary-link/);
    await expect(page.locator(".usage-help")).toHaveAttribute("open", "");
    await page.goto(`/${locale}/dashboard/family`);
    const join = page.getByRole("button", { name: t.auditUI.join });
    await join.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog
      .getByLabel(t.auditUI.invitationLabel)
      .fill("https://evil.example/login");
    await dialog
      .getByRole("button", { name: t.auditUI.openInvitation })
      .click();
    await expect(dialog.getByRole("alert")).toHaveText(
      t.auditUI.invalidInvitation,
    );
    await page.keyboard.press("Escape");
    await expect(join).toBeFocused();
    await join.click();
    const token = "a".repeat(64);
    await dialog
      .getByLabel(t.auditUI.invitationLabel)
      .fill(`https://external.example/fr/invite/${token}`);
    await dialog
      .getByRole("button", { name: t.auditUI.openInvitation })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`127.0.0.1:3107/${locale}/invite/${token}$`),
    );
    await page.goto(`/${locale}/dashboard/events`);
    await page
      .getByRole("button", { name: t.family.createFamily, exact: true })
      .click();
    await expect(dialog).toBeVisible();
    await dialog
      .getByLabel(t.family.familyName, { exact: true })
      .fill("Audit family");
    await page.screenshot({
      path: `test-results/audit-dialog-${info.project.name}-${locale}.png`,
      fullPage: true,
    });
    await dialog
      .getByRole("button", { name: t.family.create, exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard/events$`));
    const eventPanel = page.locator("details.creation-panel");
    await expect(eventPanel).toBeVisible();
    await eventPanel.locator("summary").first().click();
    await expect(page.locator("#event-family")).toContainText("Audit family");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
