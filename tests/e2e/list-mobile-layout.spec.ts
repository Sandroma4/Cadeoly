import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
for (const [locale, m] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(
    locale + ": options stay on tab roots and creation stays compact",
    async ({ page }, info) => {
      test.skip(locale === "en" && info.project.name === "mobile");
      const options = page.locator(
        'summary[aria-label="' + m.dashboard.displaySettings + '"]',
      );
      await page.goto("/" + locale + "/dashboard");
      await expect(options).toBeVisible();
      await page.goto("/" + locale + "/dashboard/wishlists/create");
      if (info.project.name === "mobile")
        await expect(options).not.toBeVisible();
      else await expect(options).toBeVisible();
      await expect(page.locator(".list-form .field-icon-bullet")).toHaveCount(
        0,
      );
      await expect(page.locator(".list-form .draft-badge")).toHaveCount(0);
      await expect(page.locator('option[value="Christmas"]')).toContainText(
        "🎄",
      );
      await expect(page.locator('option[value="Birthday"]')).toContainText(
        "🎂",
      );
      await expect(page.locator('option[value="Birth"]')).toContainText("👶");
      await page.clock.setFixedTime(new Date("2026-10-11T12:00:00"));
      page.on("dialog", (dialog) => dialog.accept());
      const template = page.locator(".list-form select").first();
      const dueDate = page.locator('input[name="neededBy"]');
      for (const [kind, date, label] of [
        ["Christmas", "2026-12-25", m.wishlist.templateChristmas],
        ["Easter", "2027-03-28", m.wishlist.templateEaster],
        ["SaintNicholas", "2026-12-06", m.wishlist.templateSaintNicholas],
        ["Wedding", "", m.wishlist.templateWedding],
      ]) {
        await template.selectOption(kind);
        await expect(dueDate).toHaveValue(date);
        await expect(page.locator('input[name="name"]')).toHaveValue(label);
      }
      await page.locator(".list-form .styled-summary").click();
      await dueDate.fill("2027-06-12");
      await expect(dueDate).toHaveValue("2027-06-12");
      await page.locator(".list-form .styled-summary").click();
      await page.clock.setFixedTime(new Date());
      const save = page.getByRole("button", {
          name: m.common.save,
          exact: true,
        }),
        cancel = page.getByRole("button", {
          name: m.common.cancel,
          exact: true,
        });
      if (info.project.name === "mobile") {
        const a = await save.boundingBox(),
          b = await cancel.boundingBox();
        expect(a!.height).toBeGreaterThanOrEqual(52);
        expect(b!.height).toBeGreaterThanOrEqual(52);
        expect(b!.x).toBeLessThan(a!.x);
        expect(Math.abs(a!.y - b!.y)).toBeLessThan(1);
        expect(a!.y + a!.height).toBeLessThanOrEqual(
          page.viewportSize()!.height - 60,
        );
        const position = a!.y;
        await page.locator(".list-form .styled-summary").click();
        await page
          .locator("#dashboard-scroll")
          .evaluate((e) => (e.scrollTop = e.scrollHeight));
        expect((await save.boundingBox())!.y).toBe(position);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(page.viewportSize()!.width);
      }
      for (const root of ["wishlists", "family", "events", "reservations"]) {
        await page.goto("/" + locale + "/dashboard/" + root);
        await expect(options).toBeVisible();
      }
    },
  );
}
