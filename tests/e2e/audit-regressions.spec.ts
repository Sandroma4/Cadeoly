import { test, expect, type Page } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

for (const [locale, t] of [
  ["fr", fr],
  ["en", en],
] as const) {
  async function register(page: Page, suffix: string) {
    await page.goto(`/${locale}/register`);
    await page.locator('input[name="name"]').fill("Audit regression");
    await page
      .locator('input[name="email"]')
      .fill(`audit-${suffix}@example.test`);
    await page.locator('input[name="password"]').fill("Browser-test-2026!");
    await page
      .getByRole("button", { name: t.auth.signUp, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
  }

  test(`${locale}: changing language preserves the list view and anchor`, async ({
    page,
  }, info) => {
    await register(
      page,
      `language-${locale}-${info.project.name}-${Date.now()}`,
    );
    await page.goto(
      `/${locale}/dashboard/wishlists?view=archived&tag=a&tag=b#dashboard-content`,
    );
    await page.locator("aside summary[aria-label]").click();
    await page
      .getByRole("button", {
        name: locale === "fr" ? "English" : "Français",
        exact: true,
      })
      .click();
    const other = locale === "fr" ? "en" : "fr";
    await expect(page).toHaveURL(
      new RegExp(
        `/${other}/dashboard/wishlists\\?view=archived&tag=a&tag=b#dashboard-content$`,
      ),
    );
    await expect(
      page.locator(
        `main a[aria-current="page"][href="/${other}/dashboard/wishlists?view=archived"]`,
      ),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath("language.png"),
      fullPage: true,
    });
  });

  test(`${locale}: editing imported gifts keeps the currency and reveals link errors`, async ({
    page,
  }, info) => {
    await register(page, `editor-${locale}-${info.project.name}-${Date.now()}`);
    const imported = await page.request.post("/api/account-import", {
      data: {
        confirm: true,
        document: {
          version: 1,
          lists: [
            {
              name: "Currency audit",
              gifts: [
                {
                  title: "Dollar book",
                  priceCents: 1250,
                  currency: "USD",
                  url: "https://shop.example/book",
                },
                {
                  title: "Other book",
                  priceCents: 900,
                  currency: "USD",
                  url: "https://shop.example/other",
                },
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
    await page.goto(`/${locale}/dashboard/wishlists/${exported.lists[0].id}`);
    const card = page.locator(".gift-card").filter({
      has: page.getByRole("heading", { name: "Dollar book", exact: true }),
    });
    await card
      .getByRole("button", { name: t.common.edit, exact: true })
      .click();
    await card
      .getByRole("button", { name: t.uiFlow.reviewGift, exact: true })
      .click();
    const price = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
    }).format(12.5);
    await expect.soft(card.locator(".gift-preview")).toContainText(price);
    await expect
      .soft(card.locator('label[for$="-price"]'))
      .toContainText("USD");
    await card.screenshot({ path: info.outputPath("currency-preview.png") });
    await card
      .getByRole("button", { name: t.uiFlow.fromLink, exact: true })
      .click();
    await card.locator('input[name="url"]').fill("https://shop.example/other");
    await card
      .getByRole("button", { name: t.uiFlow.manual, exact: true })
      .click();
    await card
      .getByRole("button", { name: t.uiFlow.reviewGift, exact: true })
      .click();
    await card
      .getByRole("button", { name: t.common.save, exact: true })
      .click();
    await expect(
      card.getByText(t.errors.duplicateGift, { exact: true }),
    ).toBeVisible();
    await expect(
      card.locator('input[name="url"][aria-invalid="true"]'),
    ).toBeVisible();
    await card.screenshot({ path: info.outputPath("link-error.png") });
    await card
      .locator('input[name="url"]')
      .fill("https://shop.example/corrected");
    await card
      .getByRole("button", { name: t.uiFlow.reviewGift, exact: true })
      .click();
    await card
      .getByRole("button", { name: t.common.save, exact: true })
      .click();
    await expect(card.locator(".gift-form")).toHaveCount(0);
    const saved = await (await page.request.get("/api/account-export")).json();
    const gift = saved.lists[0].gifts.find(
      (gift: { title: string }) => gift.title === "Dollar book",
    );
    expect(gift).toMatchObject({
      currency: "USD",
      priceCents: 1250,
      url: "https://shop.example/corrected",
    });
  });
}
