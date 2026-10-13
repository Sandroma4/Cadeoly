import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";

test("profile mobile menu, sections and controls adapt from 320px to desktop", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(180_000);
  await page.goto("/fr/register");
  await page
    .locator('[name="name"]')
    .fill("Un nom utilisateur particulièrement long pour tester le profil");
  await page
    .locator('[name="email"]')
    .fill(`profile-mobile-long-address-${Date.now()}@example.test`);
  await page.locator('[name="password"]').fill("Browser-test-2026!");
  await page.getByRole("button", { name: fr.auth.signUp, exact: true }).click();
  await expect(page).toHaveURL(/\/fr\/dashboard$/);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: fr.tutorial.skip, exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const sections = [
    "identity",
    "preferences",
    "security",
    "people",
    "data",
  ] as const;
  const scroll = page.locator("#dashboard-scroll");
  for (const width of [320, 360, 390, 430, 768, 1024, 2560]) {
    await page.setViewportSize({ width, height: width < 769 ? 740 : 1000 });
    await page.goto("/fr/dashboard/profile");
    const navigation = page.getByRole("navigation", {
      name: fr.profileSettings.navigation,
    });
    if (width <= 768) {
      await expect(page.locator("main form:visible")).toHaveCount(0);
      await expect(navigation).toBeVisible();
      await expect(
        scroll.locator(":scope > details[data-section-root]"),
      ).toBeHidden();
      if (width === 390)
        await page.screenshot({
          path: info.outputPath("profile-menu-mobile.png"),
        });
    } else {
      await expect(page.locator("#profile-identity")).toBeVisible();
    }
    expect(
      await scroll.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    for (const section of sections) {
      await page.goto(`/fr/dashboard/profile?section=${section}`);
      await expect(page.locator("main h1")).toHaveText(
        fr.profileSettings[section],
      );
      await expect(page.locator(`#profile-${section}`)).toBeVisible();
      expect(
        await scroll.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      if (width <= 768) {
        const last = page
          .locator("main button:visible, main a:visible, main select:visible")
          .last();
        await last.scrollIntoViewIfNeeded();
        const lastBox = await last.boundingBox(),
          bar = await page.locator("aside").boundingBox();
        expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(bar!.y + 1);
      }
      if (width === 390 && section === "identity") {
        await scroll.evaluate((el) => {
          el.scrollTop = 0;
        });
        await page.screenshot({
          path: info.outputPath("profile-identity-mobile.png"),
        });
      }
      await page
        .getByRole("link", { name: `← ${fr.auth.profile}`, exact: true })
        .click();
      await expect(page).toHaveURL(/\/fr\/dashboard\/profile$/);
    }
  }
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto("/fr/dashboard/profile?section=identity");
  await page
    .getByLabel(fr.auth.fullName, { exact: true })
    .fill("Profil renommé");
  await page
    .getByRole("button", { name: fr.profileSettings.saveDetails, exact: true })
    .click();
  await expect(page.locator("[data-profile-page] [role=status]")).toHaveText(
    fr.profileSettings.saved,
  );
  await page.reload();
  await expect(page.getByLabel(fr.auth.fullName, { exact: true })).toHaveValue(
    "Profil renommé",
  );
  await page.goto("/fr/dashboard/profile?section=security");
  const password = page.getByLabel(fr.accountSecurity.currentPassword, {
    exact: true,
  });
  await password.fill("Browser-test-2026!");
  await page
    .getByRole("button", { name: fr.profileSettings.showPassword, exact: true })
    .first()
    .click();
  await expect(password).toHaveAttribute("type", "text");
  await page
    .getByRole("button", { name: fr.profileSettings.hidePassword, exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");
  await page.goto("/fr/dashboard/profile?section=people");
  await expect(
    page.getByLabel(fr.convenience.recipientName, { exact: true }),
  ).toBeHidden();
  await page
    .getByText(`+ ${fr.profileSettings.addPerson}`, { exact: true })
    .click();
  await page
    .getByLabel(fr.convenience.recipientName, { exact: true })
    .fill("Alice");
  await page
    .getByRole("button", { name: fr.convenience.addRecipient, exact: true })
    .click();
  await expect(page.locator(".recipient-row summary")).toHaveText("Alice");
  await expect(
    page.getByLabel(fr.convenience.recipientName, { exact: true }),
  ).toBeHidden();
  await page.goto("/fr/dashboard/profile?section=data");
  const exported = await page.request.get("/api/account-export");
  expect(exported.ok()).toBe(true);
  await page
    .getByLabel(fr.improvements.importFile, { exact: true })
    .setInputFiles({
      name: "export-cadeoly.json",
      mimeType: "application/json",
      buffer: await exported.body(),
    });
  await expect(
    page.getByText("export-cadeoly.json", { exact: true }),
  ).toBeVisible();
  await expect(page.locator('main input[type="file"]')).toBeHidden();
  await page
    .getByRole("button", { name: fr.improvements.previewImport, exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: fr.improvements.importPreview,
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: fr.profileSettings.clearFile, exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: fr.improvements.importPreview,
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: fr.improvements.previewImport,
      exact: true,
    }),
  ).toBeDisabled();
});
