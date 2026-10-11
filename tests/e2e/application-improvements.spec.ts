import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

for (const [locale, t] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: gift details stay compact and typing sends only the final search`, async ({
    page,
  }, info) => {
    await page.goto(`/${locale}/register`);
    await page.locator('input[name="name"]').fill("Improvement owner");
    await page
      .locator('input[name="email"]')
      .fill(
        `improvements-${locale}-${info.project.name}-${Date.now()}@example.test`,
      );
    await page.locator('input[name="password"]').fill("Browser-test-2026!");
    await page
      .getByRole("button", { name: t.auth.signUp, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
    await expect(page.locator(".dashboard-actions .primary-link")).toHaveCount(
      1,
    );
    const imported = await page.request.post("/api/account-import", {
      data: {
        confirm: true,
        document: {
          version: 1,
          lists: [
            {
              name: "Compact gifts",
              gifts: [
                {
                  title: "Scarf",
                  description: "A detailed gift description",
                  size: "M",
                  priceCents: 2000,
                  currency: "EUR",
                },
                { title: "Book", priceCents: 1500, currency: "EUR" },
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
      has: page.getByRole("heading", { name: "Scarf", exact: true }),
    });
    await expect(card).toBeVisible();
    await expect(
      card.getByText("A detailed gift description", { exact: true }),
    ).toBeHidden();
    await card.locator(".gift-details-panel > summary").click();
    await expect(
      card.getByText("A detailed gift description", { exact: true }),
    ).toBeVisible();
    await expect(card.getByText("M", { exact: true })).toBeVisible();
    await expect(
      card.getByRole("button", { name: t.common.edit, exact: true }),
    ).toBeVisible();
    const searches: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.searchParams.has("_rsc") && url.searchParams.has("q"))
        searches.push(url.searchParams.get("q")!);
    });
    const search = page.locator('input[type="search"]');
    await search.pressSequentially("Scarf", { delay: 40 });
    await expect(search).toHaveValue("Scarf");
    await expect(page).toHaveURL(/q=Scarf/);
    await expect(page.locator(".gift-card")).toHaveCount(1);
    expect(searches.length).toBeGreaterThan(0);
    expect(searches.every((query) => query === "Scarf")).toBe(true);
    await page.reload();
    await expect(search).toHaveValue("Scarf");
    await expect(
      page.getByRole("heading", { name: "Scarf", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".gift-browser")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath("compact-gifts.png"),
      fullPage: true,
    });
  });
}
