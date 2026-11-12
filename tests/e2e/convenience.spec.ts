import { test, expect } from "./fixtures";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
import sharp from "sharp";

for (const [locale, t] of [["fr", fr], ["en", en]] as const) {
  test(`${locale}: quick capture, templates, drafts, links, preview and personal export`, async ({ page, request }, info) => {
    const suffix = `${info.project.name}-${locale}-${Date.now()}`;
    expect((await request.get("/api/account-export")).status()).toBe(401);
    const target = `/${locale}/quick-add?url=https%3A%2F%2Fshop.example%2Fbook&title=Shared%20book`;
    await page.goto(target);
    await expect(page).toHaveURL(/\/login\?next=/);
    await page.goto(`/${locale}/register?next=${encodeURIComponent(target)}`);
    await page.locator('input[name="name"]').fill("Convenience owner");
    await page.locator('input[name="email"]').fill(`convenience-${suffix}@example.test`);
    await page.locator('input[name="password"]').fill("Browser-test-2026!");
    await page.getByRole("button", { name: t.auth.signUp, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/quick-add\\?`));
    await page.getByRole("link", { name: t.convenience.createFirst }).click();
    await page.getByLabel(t.wishlist.template).selectOption("Birthday");
    await expect(page.locator('input[name="name"]')).toHaveValue(t.wishlist.templateBirthday);
    await page.locator('input[name="name"]').fill(`Draft ${suffix}`);
    await page.reload();
    await expect(page.locator('input[name="name"]')).toHaveValue(`Draft ${suffix}`);
    await page.getByRole("button", { name: t.common.save, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/quick-add\\?`));
    await expect(page.locator('input[name="url"]')).toHaveValue("https://shop.example/book");
    await expect(page.locator('input[name="title"]')).toHaveValue("Shared book");
    await page.locator('input[name="title"]').fill("Saved draft book");
    await page.locator('input[name="price"]').fill("12.50");
    await page.getByText(t.uiFlow.optionalDetails, { exact: true }).click();
    await page.locator('textarea[name="alternativeUrls"]').fill("https://second.example/book\nhttps://third.example/book");
    await page.reload();
    await expect(page.locator('input[name="title"]')).toHaveValue("Saved draft book");
    // Files are deliberately excluded from local drafts; select the photo after restoring.
    await page.locator('input[name="photo"]').setInputFiles({ name: "gift.png", mimeType: "image/png", buffer: await sharp({ create: { width: 8, height: 8, channels: 3, background: "#557799" } }).png().toBuffer() });
    await page.getByRole("button", { name: t.uiFlow.reviewGift, exact: true }).click();
    await page.getByRole("button", { name: t.uiFlow.addToList, exact: true }).click();
    await expect(page.getByText(t.uiFlow.giftSaved, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith("cadeoly-draft:")).length)).toBe(0);
    await page.getByRole("link", { name: t.convenience.openList, exact: true }).click();
    await expect(page.getByRole("heading", { name: "Saved draft book", exact: true })).toBeVisible();
    // Alternative links now sit in the card's collapsed details panel.
    const secondLink = page.locator('a[href="https://second.example/book"]').first();
    await page.locator(".gift-details-panel", { has: secondLink }).first().locator(":scope > summary").click();
    await expect(secondLink).toBeVisible();
    // The preview link was removed from the list page; the preview mode remains reachable by URL.
    await page.goto(page.url().split(/[?#]/)[0] + "?preview=1");
    await expect(page).toHaveURL(/preview=1$/);
    await expect(page.locator("#list-settings")).toHaveCount(0);
    await expect(page.getByRole("button", { name: t.wishlist.reserve, exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Saved draft book", exact: true })).toBeVisible();
    const response = await page.request.get("/api/account-export");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    const exported = await response.json();
    expect(exported.lists).toHaveLength(1);
    expect(exported.lists[0].gifts[0].alternativeUrls).toContain("https://second.example/book");
    expect(exported.lists[0].gifts[0].photo.base64.length).toBeGreaterThan(0);
    expect(JSON.stringify(exported)).not.toMatch(/shareToken|password|reservedBy|contributions/);
    await page.goto(`/${locale}/dashboard/gift-ideas`);
    await expect(page.getByRole("heading", { name: t.convenience.ideas, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Saved draft book", exact: true })).toHaveCount(0);
  });
}
