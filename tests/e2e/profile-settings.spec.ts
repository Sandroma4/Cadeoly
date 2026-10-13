import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

for (const [locale, messages] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: profile sections, photos and privacy work end to end`, async ({
    page,
    browser,
  }, info) => {
    test.skip(locale === "en" && info.project.name === "mobile");
    test.setTimeout(180_000);
    if (info.project.name === "desktop")
      await page.setViewportSize({ width: 2560, height: 1440 });
    const t = messages.profileSettings;
    async function register(target: Page, name: string, email: string) {
      await target.goto(`/${locale}/register`);
      await target.locator('[name="name"]').fill(name);
      await target.locator('[name="email"]').fill(email);
      await target.locator('[name="password"]').fill("Browser-test-2026!");
      await target
        .getByRole("button", { name: messages.auth.signUp, exact: true })
        .click();
      await expect(target).toHaveURL(new RegExp(`/${locale}/dashboard$`));
      await target
        .getByRole("dialog")
        .getByRole("button", { name: messages.tutorial.skip, exact: true })
        .click();
      await expect(target.getByRole("dialog")).not.toBeVisible();
    }
    const suffix = `${locale}-${info.project.name}-${Date.now()}`;
    await register(page, "Photo owner", `photo-owner-${suffix}@example.test`);
    await page.goto(`/${locale}/dashboard/profile`);
    await expect(page.locator("main h1")).toHaveCount(1);
    const navigation = page.getByRole("navigation", { name: t.navigation });
    for (const section of [
      "identity",
      "preferences",
      "security",
      "people",
      "data",
    ] as const) {
      await navigation
        .getByRole("link", { name: t[section], exact: true })
        .click();
      await expect(page.locator(`#profile-${section}`)).toBeInViewport();
      if (info.project.name === "mobile")
        await page
          .getByRole("link", {
            name: `← ${messages.auth.profile}`,
            exact: true,
          })
          .click();
    }
    expect(
      await page
        .locator("#dashboard-scroll")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    if (info.project.name === "mobile")
      await page.goto(`/${locale}/dashboard/profile?section=identity`);
    const photoForm = page.locator("#profile-identity form");
    await expect(page.getByLabel(t.visibility)).toHaveValue("PRIVATE");
    const png = await sharp({
      create: { width: 32, height: 32, channels: 3, background: "#805ad5" },
    })
      .png()
      .toBuffer();
    await page
      .getByLabel(t.choosePhoto, { exact: true })
      .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: png });
    await photoForm
      .getByRole("button", { name: messages.common.save, exact: true })
      .click();
    await expect(photoForm.getByRole("status")).toHaveText(t.photoSaved);
    const avatar = page.locator("#profile-identity img");
    await expect(avatar).toHaveAttribute("src", /\/api\/profile-photos\//);
    const firstUrl = (await avatar.getAttribute("src"))!;
    const ownResponse = await page.request.get(firstUrl);
    expect(ownResponse.status()).toBe(200);
    expect(ownResponse.headers()["cache-control"]).toContain("no-store");
    if (info.project.name === "desktop")
      await expect(page.locator('aside a[href$="/profile"] img')).toBeVisible();
    await page.locator("#dashboard-scroll").evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.screenshot({ path: info.outputPath("profile.png") });

    const visitor = await browser.newContext({
      baseURL: "http://127.0.0.1:3107",
    });
    const relative = await browser.newContext({
      baseURL: "http://127.0.0.1:3107",
    });
    const outsider = await browser.newContext({
      baseURL: "http://127.0.0.1:3107",
    });
    try {
      expect((await visitor.request.get(firstUrl)).status()).toBe(404);
      const relativePage = await relative.newPage();
      const relativeEmail = `photo-relative-${suffix}@example.test`;
      await register(relativePage, "Photo relative", relativeEmail);
      const outsiderPage = await outsider.newPage();
      await register(
        outsiderPage,
        "Photo outsider",
        `photo-outsider-${suffix}@example.test`,
      );
      expect((await outsider.request.get(firstUrl)).status()).toBe(404);

      await page.goto(`/${locale}/dashboard/family`);
      await page
        .getByRole("button", {
          name: messages.family.createFamily,
          exact: true,
        })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel(messages.family.familyName, { exact: true })
        .fill("Photo family");
      await dialog
        .getByRole("button", { name: messages.family.create, exact: true })
        .click();
      await expect(dialog).not.toBeVisible();
      await page.locator(".invitation-panel > summary").click();
      await page
        .getByLabel(messages.family.inviteEmail, { exact: true })
        .fill(relativeEmail);
      await page
        .getByRole("button", { name: messages.family.generate, exact: true })
        .click();
      const invitation = page.locator('a[href*="/invite/"]');
      await expect(invitation).toHaveAttribute("href", /\/invite\//);
      await relativePage.goto((await invitation.getAttribute("href"))!);
      await relativePage
        .getByRole("button", { name: messages.family.join, exact: true })
        .click();
      await expect(relativePage).toHaveURL(
        new RegExp(`/${locale}/dashboard/family$`),
      );
      await relativePage.goto(`/${locale}/dashboard/family`);
      await expect(
        relativePage.getByRole("img", { name: "Photo owner", exact: true }),
      ).toHaveCount(0);

      await page.goto(`/${locale}/dashboard/profile?section=identity`);
      await page.getByLabel(t.visibility).selectOption("FAMILY");
      await expect(photoForm.getByRole("status")).toHaveText(t.photoSaved);
      expect((await relative.request.get(firstUrl)).status()).toBe(200);
      expect((await outsider.request.get(firstUrl)).status()).toBe(404);
      await relativePage.reload();
      await expect(
        relativePage.getByRole("img", { name: "Photo owner", exact: true }),
      ).toBeVisible();

      await page.getByLabel(t.visibility).selectOption("MEMBERS");
      await expect(photoForm.getByRole("status")).toHaveText(t.photoSaved);
      expect((await outsider.request.get(firstUrl)).status()).toBe(200);
      expect((await visitor.request.get(firstUrl)).status()).toBe(404);

      await page.getByLabel(t.choosePhoto, { exact: true }).setInputFiles({
        name: "replacement.png",
        mimeType: "image/png",
        buffer: png,
      });
      await photoForm
        .getByRole("button", { name: messages.common.save, exact: true })
        .click();
      await expect(
        photoForm.getByRole("button", {
          name: messages.common.save,
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(avatar).toHaveAttribute("src", /\/api\/profile-photos\//);
      await expect(avatar).not.toHaveAttribute("src", firstUrl);
      expect((await page.request.get(firstUrl)).status()).toBe(404);
      const replacement = (await avatar.getAttribute("src"))!;
      await photoForm
        .getByRole("button", { name: t.removePhoto, exact: true })
        .click();
      await expect(photoForm.getByRole("status")).toHaveText(t.photoRemoved);
      await expect(avatar).toHaveCount(0);
      expect((await outsider.request.get(replacement)).status()).toBe(404);
    } finally {
      await visitor.close();
      await relative.close();
      await outsider.close();
    }
  });
}
