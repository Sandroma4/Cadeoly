import { test, expect, type Page } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

for (const [locale, t] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: server pages retain filters and collective gifts remind the actual recipient`, async ({
    page,
    browser,
  }, info) => {
    const suffix = `${locale}-${info.project.name}-${Date.now()}`;
    async function register(
      target: Page,
      role: string,
      next = `/${locale}/dashboard`,
    ) {
      await target.goto(`/${locale}/register?next=${encodeURIComponent(next)}`);
      await target.locator('input[name="name"]').fill(role);
      await target
        .locator('input[name="email"]')
        .fill(`${role}-${suffix}@example.test`);
      await target.locator('input[name="password"]').fill("Browser-test-2026!");
      await target
        .getByRole("button", { name: t.auth.signUp, exact: true })
        .click();
      await expect(target).toHaveURL(
        new RegExp(next.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"),
      );
    }
    await register(page, "Owner");
    const response = await page.request.post("/api/account-import", {
      data: {
        confirm: true,
        document: {
          version: 1,
          lists: [
            {
              name: "Paged family list",
              recipient: { name: "Child" },
              gifts: Array.from({ length: 49 }, (_, i) => ({
                title:
                  i === 48
                    ? "Group gift"
                    : i === 0 || i === 25
                      ? `Écharpe ${i}`
                      : `Gift ${i}`,
                priceCents: 1000,
                currency: "EUR",
                isGroupGift: i === 48,
              })),
            },
          ],
        },
      },
    });
    expect(response.status()).toBe(200);
    const exported = await (
      await page.request.get("/api/account-export")
    ).json();
    const path = `/${locale}/dashboard/wishlists/${exported.lists[0].id}`;
    await page.goto(path);
    await expect(page.locator(".gift-grid > div")).toHaveCount(24);
    await page
      .getByRole("button", { name: t.improvements.next, exact: true })
      .click();
    await expect(page).toHaveURL(/page=2/);
    await page.reload();
    await expect(page.locator(".gift-grid > div")).toHaveCount(24);
    await page.locator('input[type="search"]').fill("echarpe");
    await expect(page.locator(".gift-grid > div")).toHaveCount(2);
    await expect(page).toHaveURL(/q=echarpe/);
    await page.reload();
    await expect(page.locator('input[type="search"]')).toHaveValue("echarpe");
    await expect(page.locator(".gift-grid > div")).toHaveCount(2);
    await page.locator('input[type="search"]').fill("no match");
    await expect(page.locator(".gift-grid > div")).toHaveCount(0);
    await expect(
      page.getByText(t.giftSearch.noResults, { exact: true }),
    ).toBeVisible();
    await expect(page.locator('input[type="search"]')).toBeVisible();
    for (const query of ["all", "recent"]) {
      await page.locator('input[type="search"]').fill(query);
      await expect(page).toHaveURL(new RegExp(`q=${query}`));
      await expect(
        page.getByText(t.giftSearch.noResults, { exact: true }),
      ).toBeVisible();
    }
    await page.locator('input[type="search"]').fill("");
    await expect(page.locator(".gift-grid > div")).toHaveCount(24);
    await page.locator("#list-settings > summary").click();
    await page.locator('select[name="visibility"]').selectOption("LINK");
    await page
      .locator(".list-form")
      .getByRole("button", { name: t.common.save, exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: t.wishlist.createShare, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: t.wishlist.createShare, exact: true })
      .click();
    const link = page.locator('#list-share a[href*="/share/"]');
    await expect(link).toHaveAttribute("href", /\/share\/[a-f0-9]{64}$/);
    const href = (await link.getAttribute("href"))!;
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:3107",
      viewport: page.viewportSize(),
    });
    try {
      const giver = await context.newPage();
      await register(giver, "Giver", href);
      await giver.locator('input[type="search"]').fill("Group gift");
      const group = giver.locator(".gift-card").filter({
        has: giver.getByRole("heading", { name: "Group gift", exact: true }),
      });
      await group.getByLabel(t.contributions.amount).fill("2.00");
      await group
        .getByRole("button", { name: t.contributions.join, exact: true })
        .click();
      await expect(
        group.getByRole("button", {
          name: t.contributions.cancel,
          exact: true,
        }),
      ).toBeVisible();
      await giver.locator('input[type="search"]').fill("Gift 47");
      const reservedGift = giver.locator(".gift-card").filter({
        has: giver.getByRole("heading", { name: "Gift 47", exact: true }),
      });
      await reservedGift
        .getByRole("button", { name: t.wishlist.reserve, exact: true })
        .click();
      await expect(
        reservedGift.getByRole("button", {
          name: t.wishlist.cancelReservation,
          exact: true,
        }),
      ).toBeVisible();
      await giver.goto(`/${locale}/dashboard/reservations`);
      await expect(
        giver.getByText(t.reservations.for.replace("{name}", "Child"), {
          exact: true,
        }),
      ).toBeVisible();
      await giver.goto(`/${locale}/dashboard`);
      await expect(
        giver
          .locator(".reminder-list")
          .getByRole("link", { name: "Group gift", exact: true }),
      ).toBeVisible();
      await expect(giver.locator(".reminder-list")).toContainText(
        t.improvements.contributedGift.replace("{name}", "Child"),
      );
      await giver.screenshot({
        path: info.outputPath("collective-reminders.png"),
        fullPage: true,
      });
      expect(
        await giver.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    } finally {
      await context.close();
    }
  });
}
