import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";
test("guest edits a private list and another guest cannot access it", async ({
  page,
  browser,
}) => {
  await page.goto("/fr/dashboard/wishlists/create");
  await page.locator('input[name="name"]').fill("Private guest list");
  await page.getByRole("button", { name: fr.common.save, exact: true }).click();
  await expect(page).toHaveURL(/dashboard\/wishlists\/(?!create$)[^/]+$/);
  const url = page.url();
  await page.locator("#list-settings > summary").click();
  await page
    .locator('#list-settings input[name="name"]')
    .fill("Renamed private list");
  await page
    .locator("#list-settings")
    .getByRole("button", { name: fr.common.save, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Renamed private list", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Renamed private list", exact: true }),
  ).toBeVisible();
  const fresh = await browser.newContext();
  try {
    const p = await fresh.newPage();
    await p.goto(url);
    await expect(
      p.getByRole("heading", { name: fr.common.notFound, exact: true }),
    ).toBeVisible();
  } finally {
    await fresh.close();
  }
  await page.goto("/fr/dashboard/wishlists");
  const menu = page.locator("details").filter({
    has: page.locator('summary[aria-label$=" : Renamed private list"]'),
  });
  const card = page.locator("[class*=wishlistCard]").filter({ has: menu });
  await expect(card).toHaveCount(1);
  const trigger = menu.locator("summary");
  await expect(trigger).toBeVisible();
  const cardBounds = await card.boundingBox();
  const triggerBounds = await trigger.boundingBox();
  expect(cardBounds).not.toBeNull();
  expect(triggerBounds).not.toBeNull();
  expect(triggerBounds!.x).toBeGreaterThanOrEqual(cardBounds!.x);
  expect(triggerBounds!.y).toBeGreaterThanOrEqual(cardBounds!.y);
  expect(triggerBounds!.x + triggerBounds!.width).toBeLessThanOrEqual(
    cardBounds!.x + cardBounds!.width,
  );
  await trigger.click();
  await expect(menu).toHaveAttribute("open", "");
  await expect(menu.getByRole("button").first()).toBeVisible();
  page.on("dialog", (dialog) => dialog.accept());
  await menu
    .getByRole("button", { name: fr.listLifecycle.trash, exact: true })
    .click();
  await expect(page).toHaveURL(/view=trash/);
  await page.goto("/fr/dashboard/wishlists?view=trash");
  await menu.locator("summary").click();
  const restore = menu.getByRole("button", {
    name: fr.listLifecycle.restore,
    exact: true,
  });
  await expect(restore).toBeVisible();
  await expect(card).toHaveCSS("overflow", "visible");
  // Visibility alone does not detect a button clipped by an ancestor.
  await restore.click({ trial: true });
  await restore.click();
  await expect(page).not.toHaveURL(/view=trash/);
  await expect(card).toBeVisible();
});
