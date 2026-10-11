import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
for (const [locale, m] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: guest reserves, returns, cancels and links an account through email proof`, async ({
    page,
    browser,
  }, info) => {
    test.skip(
      locale === "en" && info.project.name === "mobile",
      "Both locales and one mobile viewport covered",
    );
    const t = m.guestReservation,
      suffix = `${Date.now()}-${info.project.name}`,
      email = `guest-${suffix}@example.test`;
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
      await book.getByRole("button", { name: t.reserve, exact: true }).click();
      await book.getByLabel(t.firstName, { exact: true }).fill("Lou");
      await book.getByLabel(t.email, { exact: true }).fill(email);
      await book
        .getByLabel(t.message, { exact: true })
        .fill("Happy 70th birthday!");
      await book.getByRole("button", { name: t.confirm, exact: true }).click();
      await expect(
        guest.getByRole("heading", { name: t.success, exact: true }),
      ).toBeVisible();
      const management = guest.url();
      expect(
        await (await guest.request.get("/api/auth/session")).json(),
      ).toBeNull();
      await guest.reload();
      await expect(
        guest.getByRole("heading", { name: t.success, exact: true }),
      ).toBeVisible();
      const outsider = await other.newPage();
      expect((await outsider.goto(management))!.status()).toBe(404);
      await outsider.goto(href);
      await expect(
        outsider
          .locator(".gift-card")
          .filter({
            has: outsider.getByRole("heading", {
              name: "Guest book",
              exact: true,
            }),
          })
          .getByRole("button", { name: t.reserved, exact: true }),
      ).toBeDisabled();
      await page.goto(ownerURL);
      await expect(
        page.getByText("Happy 70th birthday!", { exact: true }),
      ).toHaveCount(0);
      await guest.getByRole("button", { name: t.given, exact: true }).click();
      await expect(guest.getByRole("status")).toHaveText(t.givenDone);
      await page.reload();
      await expect(
        page.getByText("Happy 70th birthday!", { exact: true }),
      ).toBeVisible();
      await guest.goto(href);
      await expect(book.getByRole("link", { name: t.manage })).toBeVisible();
      const game = guest.locator(".gift-card").filter({
        has: guest.getByRole("heading", { name: "Guest game", exact: true }),
      });
      await game.getByRole("button", { name: t.reserve, exact: true }).click();
      await game.getByLabel(t.firstName, { exact: true }).fill("Lou");
      await game.getByLabel(t.email, { exact: true }).fill(email);
      await game.getByRole("button", { name: t.confirm, exact: true }).click();
      await guest.getByRole("button", { name: t.cancel, exact: true }).click();
      await guest
        .getByRole("button", { name: t.cancelConfirm, exact: true })
        .click();
      await expect(
        guest.getByRole("heading", { name: t.cancelled, exact: true }),
      ).toBeVisible();
      await guest.goto(management);
      await guest.getByRole("link", { name: t.signup, exact: true }).click();
      await expect(guest.locator('[name="email"]')).toHaveValue(email);
      await expect(guest.locator('[name="name"]')).toHaveValue("Lou");
      await guest.locator('[name="password"]').fill("Browser-test-2026!");
      await guest
        .getByRole("button", { name: m.auth.signUp, exact: true })
        .click();
      await expect(guest).toHaveURL(management);
      await guest.getByRole("button", { name: t.attach, exact: true }).click();
      await expect(guest.locator('p[role="alert"]')).toHaveText(
        m.errors.guestEmailProof,
      );
      let link = "";
      for (const dir of fs
        .readdirSync(os.tmpdir())
        .filter((n) => n.startsWith("cadeoly-e2e-"))) {
        const mail = path.join(os.tmpdir(), dir, "mail");
        if (!fs.existsSync(mail)) continue;
        for (const f of fs
          .readdirSync(mail)
          .filter((n) => n.endsWith(".json"))) {
          const data = JSON.parse(fs.readFileSync(path.join(mail, f), "utf8"));
          if (data.to === email && data.text.includes("Guest book"))
            link =
              data.text.match(
                /http[^\s]+\/api\/guest-reservations\/[^\s]+/,
              )?.[0] || "";
        }
      }
      expect(link).toBeTruthy();
      await guest.goto(link);
      await expect(guest).toHaveURL(management);
      await guest.getByRole("button", { name: t.attach, exact: true }).click();
      await expect(guest).toHaveURL(
        new RegExp(`/${locale}/dashboard/reservations$`),
      );
      await expect(
        guest.getByRole("heading", { name: "Guest book", exact: true }),
      ).toBeVisible();
      await outsider.goto(href);
      await expect(
        outsider
          .locator(".gift-card")
          .filter({
            has: outsider.getByRole("heading", {
              name: "Guest game",
              exact: true,
            }),
          })
          .getByRole("button", { name: t.reserve, exact: true }),
      ).toBeEnabled();
    } finally {
      await context.close();
      await other.close();
    }
  });
}
