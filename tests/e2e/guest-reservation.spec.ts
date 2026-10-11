import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
for (const [locale, m] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: a visitor must sign in before reserving`, async ({
    page,
    browser,
  }, info) => {
    test.skip(
      locale === "en" && info.project.name === "mobile",
      "Both locales and one mobile viewport covered",
    );
    const suffix = `${Date.now()}-${info.project.name}`;
    await page.goto(`/${locale}/register`);
    await page.locator('[name="name"]').fill("Owner");
    await page.locator('[name="email"]').fill(`owner-${suffix}@example.test`);
    await page.locator('[name="password"]').fill("Browser-test-2026!");
    await page
      .getByRole("button", { name: m.auth.signUp, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
    await page
      .getByRole("button", { name: m.tutorial.skip, exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    expect(
      (
        await page.request.post("/api/account-import", {
          data: {
            confirm: true,
            document: {
              version: 1,
              lists: [
                {
                  name: "Guest birthday",
                  gifts: [{ title: "Guest book" }, { title: "Guest game" }],
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
    const ownerURL = `/${locale}/dashboard/wishlists/${exported.lists[0].id}`;
    await page.goto(ownerURL);
    await page.locator("#list-settings > summary").click();
    await page.locator('select[name="visibility"]').selectOption("LINK");
    await page
      .locator(".list-form")
      .getByRole("button", { name: m.common.save, exact: true })
      .click();
    await page
      .getByRole("button", { name: m.wishlist.createShare, exact: true })
      .click();
    const shared = page.locator('#list-share a[href*="/share/"]');
    await expect(shared).toHaveAttribute("href", /\/share\/[a-f0-9]{64}$/);
    const href = (await shared.getAttribute("href"))!;
    const context = await browser.newContext({
        baseURL: "http://127.0.0.1:3107",
        viewport: page.viewportSize(),
      }),
      other = await browser.newContext({ baseURL: "http://127.0.0.1:3107" });
    try {
      const guest = await context.newPage();
      await guest.goto(href);
      const book = guest.locator(".gift-card").filter({
        has: guest.getByRole("heading", { name: "Guest book", exact: true }),
      });
      await expect(
        book.getByRole("link", { name: m.guestAccount.reserve, exact: true }),
      ).toBeVisible();
      await expect(book.locator("input")).toHaveCount(0);
      await book
        .getByRole("link", { name: m.guestAccount.reserve, exact: true })
        .click();
      await expect(guest).toHaveURL(
        new RegExp("/" + locale + "/login\\?next="),
      );
      expect(
        await (await guest.request.get("/api/auth/session")).json(),
      ).toBeNull();
    } finally {
      await context.close();
      await other.close();
    }
  });
}
