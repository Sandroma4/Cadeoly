import { test, expect, type Page } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

for (const [locale, t] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: preparation stays private and quick undo survives removed cards`, async ({
    page,
    browser,
  }, info) => {
    test.skip(
      info.project.name !== "desktop",
      "Preparation and undo persistence do not depend on viewport",
    );
    const suffix = `${locale}-${Date.now()}`;
    async function register(
      target: Page,
      role: string,
      next = `/${locale}/dashboard`,
    ) {
      await target.goto(`/${locale}/register?next=${encodeURIComponent(next)}`);
      await target.locator('input[name="name"]').fill(role);
      await target
        .locator('input[name="email"]')
        .fill(`preparation-${role}-${suffix}@example.test`);
      await target.locator('input[name="password"]').fill("Browser-test-2026!");
      await target
        .getByRole("button", { name: t.auth.signUp, exact: true })
        .click();
      await expect(target).toHaveURL(new RegExp(`${next}$`));
    }
    await register(page, "Owner");
    expect(
      (
        await page.request.post("/api/account-import", {
          data: {
            confirm: true,
            document: {
              version: 1,
              lists: [
                {
                  name: "Preparation gifts",
                  gifts: [{ title: "Preparation book" }],
                },
              ],
            },
          },
        })
      ).status(),
    ).toBe(200);
    const exported = await (
      await page.request.get("/api/account-export")
    ).json();
    await page.goto(`/${locale}/dashboard/wishlists/${exported.lists[0].id}`);
    const ownerURL = page.url();
    const gift = page
      .locator(".gift-card")
      .filter({
        has: page.getByRole("heading", {
          name: "Preparation book",
          exact: true,
        }),
      });
    page.once("dialog", (dialog) => dialog.accept());
    await gift
      .getByRole("button", { name: t.giftTrash.move, exact: true })
      .click();
    await expect(gift).toHaveCount(0);
    await page
      .getByRole("button", { name: t.quickUndo.undo, exact: true })
      .click();
    await expect(gift).toBeVisible();
    await page.locator("#list-settings > summary").click();
    await page.locator('select[name="visibility"]').selectOption("LINK");
    await page
      .locator(".list-form")
      .getByRole("button", { name: t.common.save, exact: true })
      .click();
    await page
      .getByRole("button", { name: t.wishlist.createShare, exact: true })
      .click();
    const shared = page.locator('#list-share a[href*="/share/"]');
    await expect(shared).toHaveAttribute("href", /\/share\/[a-f0-9]{64}$/);
    const href = (await shared.getAttribute("href"))!;
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:3107",
      viewport: page.viewportSize(),
    });
    try {
      const giver = await context.newPage();
      await register(giver, "Giver", href);
      await giver
        .getByRole("button", { name: t.wishlist.reserve, exact: true })
        .click();
      await expect(
        giver.getByRole("button", {
          name: t.wishlist.cancelReservation,
          exact: true,
        }),
      ).toBeVisible();
      await giver.goto(`/${locale}/dashboard/reservations`);
      const preparation = giver.getByLabel(t.preparation.label, {
        exact: true,
      });
      await expect(preparation).toHaveValue("RESERVED");
      for (const stage of ["BOUGHT", "WRAPPED", "GIVEN"]) {
        await preparation.selectOption(stage);
        await expect(preparation).toHaveValue(stage);
        await expect(preparation).toBeEnabled();
      }
      await giver.reload();
      await expect(preparation).toHaveValue("GIVEN");
      await page.goto(ownerURL);
      await expect(
        page.getByLabel(t.preparation.label, { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByText(t.preparation.GIVEN, { exact: true }),
      ).toHaveCount(0);
      await giver
        .getByRole("button", {
          name: t.wishlist.cancelReservation,
          exact: true,
        })
        .click();
      await expect(preparation).toHaveCount(0);
      await giver
        .getByRole("button", { name: t.quickUndo.undo, exact: true })
        .click();
      await expect(preparation).toHaveValue("GIVEN");
      await giver.reload();
      await expect(preparation).toHaveValue("GIVEN");
      await giver.goto(href);
      await expect(
        giver.getByLabel(t.preparation.label, { exact: true }),
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
}
