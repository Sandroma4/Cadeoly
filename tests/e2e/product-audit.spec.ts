import { test, expect, type Page } from "@playwright/test";
import { createTranslator } from "next-intl";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

for (const [locale, m] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: first steps, social sharing, countdown, funding and given gifts`, async ({
    page,
    browser,
  }, info) => {
    test.skip(
      (locale === "fr" && info.project.name !== "desktop") ||
        (locale === "en" && info.project.name !== "mobile"),
      "One desktop and one mobile scenario cover both translations",
    );
    const t = createTranslator({ locale, messages: m });
    const suffix = `${locale}-${Date.now()}`;
    const giverEmail = `giver-${suffix}@example.test`;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    async function register(target: Page, email: string) {
      await target.goto(`/${locale}/register`);
      await target.locator('[name="name"]').fill("Audit user");
      await target.locator('[name="email"]').fill(email);
      await target.locator('[name="password"]').fill("Browser-test-2026!");
      await target
        .getByRole("button", { name: m.auth.signUp, exact: true })
        .click();
      await expect(target).toHaveURL(new RegExp(`/${locale}/dashboard$`));
      await target
        .getByRole("dialog")
        .getByRole("button", { name: m.tutorial.skip, exact: true })
        .click();
      await expect(target.getByRole("dialog")).not.toBeVisible();
    }
    await register(page, `owner-${suffix}@example.test`);
    const onboarding = page.locator('details[class*="disclosure"]');
    await expect(onboarding).toContainText(
      t("onboarding.compactProgress", { count: 0 }),
    );
    await onboarding.locator("summary").click();
    await onboarding
      .getByRole("link", { name: new RegExp(m.onboarding.list) })
      .click();
    const breadcrumbs = page.getByRole("navigation", {
      name: m.breadcrumbs.label,
    });
    await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText(
      m.breadcrumbs.createWishlist,
    );
    await page.locator('.list-form [name="name"]').fill("First list");
    await page
      .locator(".list-form")
      .getByRole("button", { name: m.common.save, exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/wishlists\/[^/]+$/);
    await expect(
      page.getByRole("status").filter({ hasText: m.notifications.listCreated }),
    ).toBeVisible();
    await page.getByRole("button", { name: m.notifications.dismiss }).click();
    await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText(
      m.breadcrumbs.wishlistDetails,
    );
    expect(
      (
        await page.request.post("/api/account-import", {
          data: {
            confirm: true,
            document: {
              version: 1,
              lists: [
                {
                  name: "Audit gifts",
                  gifts: [
                    {
                      title: "Small book",
                      priceCents: 2000,
                      currency: "EUR",
                      priority: "HIGH",
                    },
                    {
                      title: "Group trip",
                      priceCents: 10000,
                      currency: "EUR",
                      isGroupGift: true,
                    },
                    { title: "Dollar game", priceCents: 2000, currency: "USD" },
                  ],
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
    const listId = exported.lists.find(
      (list: { name: string }) => list.name === "Audit gifts",
    ).id;
    const listUrl = `/${locale}/dashboard/wishlists/${listId}`;
    await page.goto(`/${locale}/dashboard`);
    await expect(onboarding).toHaveCount(0);
    await page.goto(listUrl);
    await page.locator("#list-settings > summary").click();
    await page.locator('select[name="visibility"]').selectOption("LINK");
    await page
      .locator(".list-form")
      .getByRole("button", { name: m.common.save, exact: true })
      .click();
    await page
      .getByRole("button", { name: m.wishlist.createShare, exact: true })
      .click();
    const share = page.locator("#list-share");
    const href = (await share
      .locator('a[href*="/share/"]')
      .getAttribute("href"))!;
    await page.evaluate(() => {
      const nativeClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (this.isConnected) return nativeClick.call(this);
        (window as typeof window & { auditShare?: object }).auditShare = {
          href: this.href,
          rel: this.rel,
          referrerPolicy: this.referrerPolicy,
        };
      };
    });
    for (const channel of ["whatsapp", "sms", "email"] as const) {
      await share
        .getByRole("button", { name: m.sharing[channel], exact: true })
        .click();
      const captured = await page.evaluate(
        () =>
          (
            window as typeof window & {
              auditShare: { href: string; rel: string; referrerPolicy: string };
            }
          ).auditShare,
      );
      const url = new URL(captured.href);
      expect(url.protocol).toBe(
        channel === "whatsapp"
          ? "https:"
          : channel === "sms"
            ? "sms:"
            : "mailto:",
      );
      expect(decodeURIComponent(captured.href)).toContain(href);
      expect(decodeURIComponent(captured.href)).toContain("Audit gifts");
      expect(captured.rel).toContain("noreferrer");
      expect(captured.referrerPolicy).toBe("no-referrer");
    }
    const book = page.locator(".gift-card").filter({
      has: page.getByRole("heading", { name: "Small book", exact: true }),
    });
    await expect(book.locator('[data-priority="HIGH"]')).toBeVisible();
    await expect(page.locator(".gift-funding")).toHaveCount(0);

    await page.goto(`/${locale}/dashboard/family`);
    await page
      .getByRole("button", { name: m.family.createFamily, exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel(m.family.familyName, { exact: true })
      .fill("Audit family");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: m.family.create, exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.locator("details.invitation-panel > summary").click();
    await page
      .getByLabel(m.family.inviteEmail, { exact: true })
      .fill(giverEmail);
    await page
      .getByRole("button", { name: m.family.generate, exact: true })
      .click();
    const invitation = page.locator('a[href*="/invite/"]');
    await expect(invitation).toHaveCount(1);
    const inviteUrl = (await invitation.getAttribute("href"))!;
    await page.goto(`/${locale}/dashboard`);
    await expect(onboarding).toHaveCount(0);
    await page.goto(`/${locale}/dashboard/events`);
    await page.locator("details.creation-panel > summary").click();
    const eventForm = page.locator("#create-event-form");
    const eventDay = new Date(Date.now() + 2 * 86400000)
      .toISOString()
      .slice(0, 10);
    await eventForm.locator('[name="name"]').fill("Audit birthday");
    await eventForm.locator('[name="date"]').fill(eventDay);
    await eventForm
      .getByRole("button", { name: m.events.create, exact: true })
      .click();
    await expect(
      page.getByText(t("eventCountdown.future", { count: 2 }), { exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: m.events.view, exact: true }).click();
    await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText(
      m.breadcrumbs.eventDetails,
    );
    await expect(
      page.getByText(t("eventCountdown.future", { count: 2 }), { exact: true }),
    ).toBeVisible();
    await page.goto(listUrl);
    await page.locator("#list-settings > summary").click();
    await page.locator('select[name="visibility"]').selectOption("FAMILY");
    await page
      .locator(".list-form")
      .getByRole("button", { name: m.common.save, exact: true })
      .click();

    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:3107",
      viewport: page.viewportSize(),
    });
    try {
      const giver = await context.newPage();
      giver.on("pageerror", (error) => errors.push(error.message));
      await register(giver, giverEmail);
      await giver.goto(inviteUrl);
      await giver
        .getByRole("button", { name: m.family.join, exact: true })
        .click();
      await expect(giver).toHaveURL(new RegExp(`/${locale}/dashboard/family$`));
      await giver.goto(`/${locale}/dashboard/gift-ideas`);
      await giver
        .getByLabel(m.giftSuggestions.range, { exact: true })
        .selectOption("under25");
      await expect(
        giver.getByRole("heading", { name: "Small book", exact: true }),
      ).toBeVisible();
      await expect(
        giver.getByRole("heading", { name: "Dollar game", exact: true }),
      ).toHaveCount(0);
      await expect(
        giver.getByRole("heading", { name: "Group trip", exact: true }),
      ).toHaveCount(0);
      await giver
        .getByLabel(m.giftSuggestions.currency, { exact: true })
        .selectOption("USD");
      await expect(
        giver.getByRole("heading", { name: "Dollar game", exact: true }),
      ).toBeVisible();
      await expect(
        giver.getByRole("heading", { name: "Small book", exact: true }),
      ).toHaveCount(0);
      await giver.goto(listUrl);
      const groupCard = giver.locator(".gift-card").filter({
        has: giver.getByRole("heading", { name: "Group trip", exact: true }),
      });
      await expect(groupCard.getByRole("progressbar")).toHaveAttribute(
        "value",
        "0",
      );
      await groupCard
        .getByLabel(m.contributions.amount, { exact: true })
        .fill("10");
      await groupCard
        .getByRole("button", { name: m.contributions.join, exact: true })
        .click();
      await expect(groupCard.getByRole("progressbar")).toHaveAttribute(
        "value",
        "1000",
      );
      const smallBook = giver.locator(".gift-card").filter({
        has: giver.getByRole("heading", { name: "Small book", exact: true }),
      });
      await smallBook
        .getByRole("button", { name: m.wishlist.reserve, exact: true })
        .click();
      await expect(
        giver.getByRole("status").filter({ hasText: m.notifications.reserved }),
      ).toBeVisible();
      await giver.goto(`/${locale}/dashboard/reservations`);
      await giver
        .getByLabel(m.preparation.label, { exact: true })
        .selectOption("GIVEN");
      const history = giver.locator('section[aria-labelledby="gift-history"]');
      await expect(
        history.getByRole("heading", { name: "Small book", exact: true }),
      ).toBeVisible();
      await expect(
        giver
          .locator('section[aria-labelledby="active-gifts"]')
          .getByRole("heading", { name: "Small book", exact: true }),
      ).toHaveCount(0);
      await expect(
        history.getByRole("button", {
          name: m.wishlist.cancelReservation,
          exact: true,
        }),
      ).toBeVisible();
      await history
        .getByRole("button", {
          name: m.wishlist.cancelReservation,
          exact: true,
        })
        .click();
      await expect(
        history.getByRole("heading", { name: "Small book", exact: true }),
      ).toHaveCount(0);
      await giver
        .getByRole("button", { name: m.quickUndo.undo, exact: true })
        .click();
      await expect(
        history.getByRole("heading", { name: "Small book", exact: true }),
      ).toBeVisible();
      await expect(
        history.getByLabel(m.preparation.label, { exact: true }),
      ).toHaveValue("GIVEN");
      await history.screenshot({ path: info.outputPath("gift-history.png") });
      expect(
        await giver.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.reload();
      await expect(page.locator(".gift-funding")).toHaveCount(0);
      await expect(
        page.getByText(m.wishlist.reserved, { exact: true }),
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
    expect(errors).toEqual([]);
  });
}
