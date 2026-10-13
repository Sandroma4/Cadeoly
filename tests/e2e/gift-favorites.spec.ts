import { test, expect, type Page } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

for (const [locale, t] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: private favorites persist, filter and survive reservation`, async ({
    page,
    browser,
  }, info) => {
    test.skip(
      info.project.name !== "desktop",
      "Favorite persistence has no viewport-specific behavior",
    );
    const suffix = `${locale}-${Date.now()}`;
    const buyerEmail = `favorite-buyer-${suffix}@example.test`;
    async function register(target: Page, name: string, email: string) {
      await target.goto(`/${locale}/register`);
      await target.locator('input[name="name"]').fill(name);
      await target.locator('input[name="email"]').fill(email);
      await target.locator('input[name="password"]').fill("Browser-test-2026!");
      await target
        .getByRole("button", { name: t.auth.signUp, exact: true })
        .click();
      await expect(target).toHaveURL(new RegExp(`/${locale}/dashboard$`));
      await target
        .getByRole("button", { name: t.tutorial.skip, exact: true })
        .click();
      await expect(target.locator("dialog[open]")).toHaveCount(0);
    }
    await register(
      page,
      "Favorite owner",
      `favorite-owner-${suffix}@example.test`,
    );
    await page.goto(`/${locale}/dashboard/family`);
    await page
      .getByRole("button", { name: t.family.createFamily, exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel(t.family.familyName, { exact: true })
      .fill("Favorite family");
    await dialog
      .getByRole("button", { name: t.family.create, exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await page.locator(".invitation-panel > summary").click();
    await page
      .getByLabel(t.family.inviteEmail, { exact: true })
      .fill(buyerEmail);
    await page
      .getByRole("button", { name: t.family.generate, exact: true })
      .click();
    const invitation = page.locator('a[href*="/invite/"]');
    await expect(invitation).toHaveAttribute("href", /\/invite\/[a-f0-9]{64}$/);
    const invitationUrl = await invitation.getAttribute("href");
    expect(
      (
        await page.request.post("/api/account-import", {
          data: {
            confirm: true,
            document: {
              version: 1,
              lists: [
                {
                  name: "Gift ideas",
                  gifts: [{ title: "Favorite book" }, { title: "Other book" }],
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
    const listUrl = `/${locale}/dashboard/wishlists/${exported.lists[0].id}`;
    await page.goto(listUrl);
    await page.locator("#list-settings > summary").click();
    await page.locator('select[name="visibility"]').selectOption("FAMILY");
    await page
      .locator(".list-form")
      .getByRole("button", { name: t.common.save, exact: true })
      .click();
    const buyerContext = await browser.newContext({
      baseURL: "http://127.0.0.1:3107",
    });
    try {
      const buyer = await buyerContext.newPage();
      await register(buyer, "Favorite buyer", buyerEmail);
      await buyer.goto(invitationUrl!);
      await buyer
        .getByRole("button", { name: t.family.join, exact: true })
        .click();
      await expect(buyer).toHaveURL(new RegExp(`/${locale}/dashboard/family$`));
      await buyer.goto(`/${locale}/dashboard/gift-ideas`);
      const search = buyer.getByRole("searchbox");
      await search.fill("Favorite book");
      await buyer
        .locator("#filter-recipient")
        .selectOption({ label: "Favorite owner" });
      await expect(search).toHaveValue("Favorite book");
      await expect(buyer.locator(".gift-card")).toHaveCount(1);
      await search.fill("No matching gift");
      await expect(
        buyer.getByText(t.giftSearch.noResults, { exact: true }),
      ).toBeVisible();
      await buyer
        .getByRole("button", { name: t.giftSearch.reset, exact: true })
        .last()
        .click();
      await expect(search).toHaveValue("");
      await expect(buyer.locator("#filter-recipient")).toHaveValue("");
      await expect(buyer.locator(".gift-card")).toHaveCount(2);
      const card = buyer.locator(".gift-card").filter({
        has: buyer.getByRole("heading", {
          name: "Favorite book",
          exact: true,
        }),
      });
      await card
        .getByRole("button", { name: t.giftFavorites.save, exact: true })
        .click();
      await expect(
        card.getByRole("button", { name: t.giftFavorites.remove, exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await buyer.reload();
      await buyer
        .getByRole("checkbox", { name: t.giftFavorites.only, exact: true })
        .check();
      await expect(buyer.locator(".gift-card")).toHaveCount(1);
      await card
        .getByRole("button", { name: t.wishlist.reserve, exact: true })
        .click();
      await expect(
        card.getByRole("button", {
          name: t.wishlist.cancelReservation,
          exact: true,
        }),
      ).toBeVisible();
      await buyer.reload();
      await buyer
        .getByRole("checkbox", { name: t.giftFavorites.only, exact: true })
        .check();
      await expect(card).toBeVisible();
      await card
        .getByRole("button", { name: t.giftFavorites.remove, exact: true })
        .click();
      await expect(buyer.locator(".gift-card")).toHaveCount(0);
      await buyer.reload();
      await buyer
        .getByRole("checkbox", { name: t.giftFavorites.only, exact: true })
        .check();
      await expect(buyer.locator(".gift-card")).toHaveCount(0);
    } finally {
      await buyerContext.close();
    }
  });
}
