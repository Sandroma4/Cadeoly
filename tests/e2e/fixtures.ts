import { test as base, expect, type Page } from "@playwright/test";

/**
 * New accounts see the welcome tutorial as a modal dialog. Specs that are not
 * about the tutorial register this handler so the dialog is skipped whenever
 * it would block an action. tutorial.spec.ts and flows that assert the dialog
 * keep importing from @playwright/test directly.
 */
export async function dismissTutorial(page: Page) {
  const dialog = page.locator('dialog[aria-labelledby="tutorial-title"]');
  await page.addLocatorHandler(dialog, async () => {
    await dialog.getByRole("button", { name: /^(Passer|Skip)$/ }).click();
  });
}

export const test = base.extend({
  page: async ({ page }, provide) => {
    await dismissTutorial(page);
    await provide(page);
  },
});

export { expect, type Page };

/**
 * Opens the current list's settings and returns the region holding the form.
 * Desktop uses the inline #list-settings disclosure; mobile links to a
 * dedicated manage page (?manage=1) instead.
 */
export async function openListSettings(page: Page) {
  // Same breakpoint as the dashboard layout (max-width: 768px).
  if ((page.viewportSize()?.width ?? 1280) > 768) {
    await page.locator("#list-settings > summary").click();
    return page.locator("#list-settings");
  }
  const url = new URL(page.url());
  url.searchParams.set("manage", "1");
  await page.goto(url.pathname + url.search);
  return page.locator("main");
}
