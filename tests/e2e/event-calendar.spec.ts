import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

for (const [locale, t] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: family event downloads an all-day calendar and denies outsiders`, async ({
    page,
    request,
  }, info) => {
    test.skip(
      info.project.name !== "desktop",
      "Calendar download has no responsive behavior",
    );
    const suffix = `${locale}-${Date.now()}`;
    await page.goto(`/${locale}/register`);
    await page.locator('input[name="name"]').fill("Calendar owner");
    await page
      .locator('input[name="email"]')
      .fill(`calendar-${suffix}@example.test`);
    await page.locator('input[name="password"]').fill("Browser-test-2026!");
    await page
      .getByRole("button", { name: t.auth.signUp, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
    await page.goto(`/${locale}/dashboard/events`);
    await page
      .getByRole("button", { name: t.family.createFamily, exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel(t.family.familyName, { exact: true })
      .fill("Calendar family");
    await dialog
      .getByRole("button", { name: t.family.create, exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await page.locator("details.creation-panel > summary").click();
    const form = page.locator("#create-event-form");
    await form.locator('input[name="name"]').fill("Fête, amis; cadeaux");
    await form.locator('input[name="date"]').fill("2030-12-31");
    await form.locator("details > summary").click();
    await form
      .locator('input[name="description"]')
      .fill("Une journée ensemble");
    await form
      .getByRole("button", { name: t.events.create, exact: true })
      .click();
    await page.getByRole("link", { name: t.events.view, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Fête, amis; cadeaux", exact: true }),
    ).toBeVisible();
    const calendarLink = page.getByRole("link", {
      name: t.events.downloadCalendar,
      exact: true,
    });
    const calendarUrl = await calendarLink.getAttribute("href");
    expect(calendarUrl).toMatch(/^\/api\/events\/[^/]+\/calendar$/);
    const downloadPromise = page.waitForEvent("download");
    await calendarLink.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("cadeoly-event.ics");
    expect(await download.failure()).toBeNull();
    const response = await page.request.get(calendarUrl!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/calendar");
    const calendar = await response.text();
    expect(calendar).toContain("DTSTART;VALUE=DATE:20301231\r\n");
    expect(calendar).toContain("DTEND;VALUE=DATE:20310101\r\n");
    expect(calendar).toContain("SUMMARY:Fête\\, amis\\; cadeaux\r\n");
    expect(calendar).toContain("DESCRIPTION:Une journée ensemble\r\n");
    expect((await request.get(calendarUrl!)).status()).toBe(401);
    const eventUrl = page.url();
    await page.context().clearCookies();
    await page.goto(`/${locale}/register`);
    await page.locator('input[name="name"]').fill("Calendar outsider");
    await page
      .locator('input[name="email"]')
      .fill(`outsider-${suffix}@example.test`);
    await page.locator('input[name="password"]').fill("Browser-test-2026!");
    await page
      .getByRole("button", { name: t.auth.signUp, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
    expect((await page.request.get(calendarUrl!)).status()).toBe(404);
    await page.goto(eventUrl);
    await expect(
      page.getByRole("heading", { name: t.common.notFound, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Fête, amis; cadeaux", exact: true }),
    ).toHaveCount(0);
  });
}
