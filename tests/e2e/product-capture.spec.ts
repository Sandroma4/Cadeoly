import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

test("captured product survives sign-in and list creation, then opens for review", async ({
  page,
}, info) => {
  const locale = info.project.name === "mobile" ? "en" : "fr";
  const t = locale === "fr" ? fr : en;
  const photo = "https://images.vinted.net/captured-product.webp";
  await page.route(photo, (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==",
        "base64",
      ),
    }),
  );
  const query = new URLSearchParams({
    url: "https://www.vinted.fr/items/123-cable",
    title: "Câble adaptateur",
    price: "8.00",
    image: photo,
  });
  const target = `/${locale}/quick-add?${query}`;
  await page.goto(target);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.goto(`/${locale}/register?next=${encodeURIComponent(target)}`);
  await page.locator('[name="name"]').fill("Product capture");
  await page
    .locator('[name="email"]')
    .fill(`capture-${info.project.name}-${Date.now()}@example.test`);
  await page.locator('[name="password"]').fill("Browser-test-2026!");
  await page.getByRole("button", { name: t.auth.signUp, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/quick-add\\?`));
  await page.getByRole("link", { name: t.convenience.createFirst }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: t.tutorial.skip, exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await page.locator('[name="name"]').fill("Captured gifts");
  await page.getByRole("button", { name: t.common.save, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/quick-add\\?`));
  await expect(page.locator('[name="title"]')).toHaveValue("Câble adaptateur");
  await expect(page.locator('[name="price"]')).toHaveValue("8.00");
  const help = page.locator(".gift-form-help");
  await expect(
    page.getByText(t.uiFlow.requiredNameHint, { exact: true }),
  ).toBeVisible();
  await expect(
    help.getByText(t.uiFlow.draftHelp, { exact: true }),
  ).not.toBeVisible();
  await help.locator("summary").click();
  await expect(
    help.getByText(t.uiFlow.draftHelp, { exact: true }),
  ).toBeVisible();
  await help.locator("summary").click();
  await expect(page.getByAltText(t.productImport.photoAlt)).toHaveAttribute(
    "src",
    photo,
  );
  await page.getByText(t.productImport.captureTitle, { exact: true }).click();
  const code = await page
    .getByRole("link", { name: t.productImport.captureBookmark, exact: true })
    .getAttribute("href");
  expect(code).toMatch(/^javascript:/);
  await page
    .getByRole("button", { name: t.uiFlow.reviewGift, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: t.uiFlow.addToList, exact: true }),
  ).toBeVisible();
  await expect(page.getByAltText(t.productImport.photoAlt)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/product-capture-${info.project.name}.png`,
    fullPage: true,
  });

  // Execute the actual bundled bookmark on an isolated public product fixture.
  await page.route("https://merchant.example/product", (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<h1>Câble adaptateur</h1><div data-qa-id="adview_price">8 €</div><meta property="og:image" content="${photo}">`,
    }),
  );
  await page.goto("https://merchant.example/product");
  const popupPromise = page.waitForEvent("popup");
  await page.evaluate((value) => {
    (0, eval)(value!.replace(/^javascript:/, ""));
  }, code);
  const popup = await popupPromise;
  await popup.waitForURL(new RegExp(`/${locale}/quick-add\\?`));
  await expect(popup.locator('[name="title"]')).toHaveValue("Câble adaptateur");
  await expect(popup.locator('[name="price"]')).toHaveValue("8.00");
  await expect(popup.getByAltText(t.productImport.photoAlt)).toHaveAttribute(
    "src",
    photo,
  );
});
