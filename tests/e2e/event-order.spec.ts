import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

for (const [locale, t] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: manual order persists through search and a family event duplicates own lists`, async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "desktop",
      "Ordering and duplication do not change responsive layout",
    );
    await page.goto(`/${locale}/register`);
    await page.locator('input[name="name"]').fill("Event owner");
    await page
      .locator('input[name="email"]')
      .fill(`event-order-${locale}-${Date.now()}@example.test`);
    await page.locator('input[name="password"]').fill("Browser-test-2026!");
    await page
      .getByRole("button", { name: t.auth.signUp, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
    const imported = await page.request.post("/api/account-import", {
      data: {
        confirm: true,
        document: {
          version: 1,
          lists: [
            {
              name: "Ordered gifts",
              gifts: [
                { title: "Alpha" },
                { title: "Beta" },
                { title: "Gamma" },
              ],
            },
          ],
        },
      },
    });
    expect(imported.status()).toBe(200);
    const exported = await (
      await page.request.get("/api/account-export")
    ).json();
    const listPath = `/${locale}/dashboard/wishlists/${exported.lists[0].id}`;
    await page.goto(listPath);
    const titles = () => page.locator(".gift-card h2").allTextContents();
    await expect(page.locator(".gift-card")).toHaveCount(3);
    const initial = await titles();
    expect(initial).toHaveLength(3);
    const target = initial[1];
    await page.locator('input[type="search"]').fill(target);
    await expect(page.locator(".gift-card")).toHaveCount(1);
    await page
      .getByRole("button", {
        name: t.wishlist.moveGiftUp.replace("{title}", target),
        exact: true,
      })
      .click();
    await page.locator('input[type="search"]').fill("");
    await expect.poll(async () => (await titles())[0]).toBe(target);
    await page.reload();
    await expect.poll(async () => (await titles())[0]).toBe(target);
    await page.goto(`/${locale}/dashboard/events`);
    await page
      .getByRole("button", { name: t.family.createFamily, exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel(t.family.familyName, { exact: true })
      .fill("Duplicate family");
    await dialog
      .getByRole("button", { name: t.family.create, exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await page.locator("details.creation-panel > summary").click();
    const create = page.locator("#create-event-form");
    await create.locator('input[name="name"]').fill("Original event");
    await create.locator('input[name="date"]').fill("2031-06-01");
    await create
      .getByRole("button", { name: t.events.create, exact: true })
      .click();
    await page.getByRole("link", { name: t.events.view, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Original event", exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`/${locale}/dashboard/events/[^/?]+$`),
    );
    const originalUrl = page.url();
    const eventId = new URL(originalUrl).pathname.split("/").at(-1)!;
    await page.goto(listPath);
    await page.locator("#list-settings > summary").click();
    await page.locator(".list-form .form-options > summary").click();
    await page.locator('select[name="eventId"]').selectOption(eventId);
    await page
      .locator(".list-form")
      .getByRole("button", { name: t.common.save, exact: true })
      .click();
    await expect(page.locator("#list-gifts header")).toContainText(
      "Original event",
    );
    await page.goto(originalUrl);
    await page.getByText(t.events.duplicate, { exact: true }).first().click();
    const duplicate = page.locator("#duplicate-event-form");
    await expect(
      duplicate.getByText(t.events.duplicateHelp, { exact: true }),
    ).toBeVisible();
    await duplicate.locator('input[name="name"]').fill("Next event");
    await duplicate.locator('input[name="date"]').fill("2032-06-01");
    await duplicate
      .getByRole("button", { name: t.events.duplicate, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Next event", exact: true }),
    ).toBeVisible();
    expect(page.url()).not.toBe(originalUrl);
    await expect(
      page.getByRole("heading", { name: "Ordered gifts", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: t.wishlist.viewList, exact: true })
      .click();
    await expect.poll(async () => (await titles())[0]).toBe(target);
    await page.locator("#list-settings > summary").click();
    await expect(page.locator('select[name="visibility"]')).toHaveValue(
      "PRIVATE",
    );
  });
}
