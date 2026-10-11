import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

for (const [locale, t] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: login and registration retain the requested protected page`, async ({
    page,
  }, info) => {
    const destination = `/${locale}/dashboard/wishlists?view=archived`;
    await page.goto(destination);
    await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?next=`));
    expect(new URL(page.url()).searchParams.get("next")).toBe(destination);
    await page.getByRole("link", { name: t.auth.signUp, exact: true }).click();
    expect(new URL(page.url()).searchParams.get("next")).toBe(destination);
    const email = `return-${locale}-${info.project.name}-${Date.now()}@example.test`;
    await page.locator('input[name="name"]').fill("Navigation owner");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill("Browser-test-2026!");
    await page
      .getByRole("button", { name: t.auth.signUp, exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/${locale}/dashboard/wishlists\\?view=archived$`),
    );
    await page.context().clearCookies();
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?next=`));
    expect(new URL(page.url()).searchParams.get("next")).toBe(destination);
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill("Browser-test-2026!");
    await page
      .getByRole("button", { name: t.auth.signIn, exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/${locale}/dashboard/wishlists\\?view=archived$`),
    );
  });

  test(`${locale}: an open editor spans a multi-gift grid without horizontal overflow`, async ({
    page,
  }, info) => {
    await page.goto(`/${locale}/register`);
    await page.locator('input[name="name"]').fill("Editor owner");
    await page
      .locator('input[name="email"]')
      .fill(`grid-${locale}-${info.project.name}-${Date.now()}@example.test`);
    await page.locator('input[name="password"]').fill("Browser-test-2026!");
    await page
      .getByRole("button", { name: t.auth.signUp, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
    const tutorial = page.getByRole("dialog");
    await expect(tutorial).toBeVisible();
    await tutorial
      .getByRole("button", { name: t.tutorial.skip, exact: true })
      .click();
    await expect(tutorial).not.toBeVisible();
    const imported = await page.request.post("/api/account-import", {
      data: {
        confirm: true,
        document: {
          version: 1,
          lists: [
            {
              name: "Editor grid",
              gifts: [
                { title: "First gift", priceCents: 1200, currency: "EUR" },
                { title: "Second gift", priceCents: 1800, currency: "EUR" },
                { title: "Third gift", priceCents: 2100, currency: "EUR" },
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
      has: page.getByRole("heading", { name: "First gift", exact: true }),
    });
    await card
      .getByRole("button", { name: t.common.edit, exact: true })
      .click();
    const editor = card.locator(".gift-editor");
    await expect(editor).toBeVisible();
    if (info.project.name === "desktop") {
      await expect
        .poll(async () => (await editor.boundingBox())?.width ?? 0)
        .toBeGreaterThanOrEqual(550);
      const grid = await page.locator(".gift-grid").boundingBox();
      const expandedCard = await card.boundingBox();
      expect(expandedCard!.width).toBeGreaterThanOrEqual(grid!.width - 2);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await editor.screenshot({ path: info.outputPath("gift-editor.png") });
  });
}
