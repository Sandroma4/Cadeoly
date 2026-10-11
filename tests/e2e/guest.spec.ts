import { test, expect } from "@playwright/test";

for (const locale of ["fr", "en"]) {
  test(`${locale}: guest discovery works without a session and private pages stay protected`, async ({
    page,
  }, info) => {
    test.skip(
      locale === "en" && info.project.name === "mobile",
      "One mobile layout and both languages are covered",
    );
    const entry =
      locale === "fr" ? "Continuer en tant qu’invité" : "Continue as a guest";
    await page.goto(`/${locale}`);
    await page.getByRole("link", { name: entry, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/guest$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      locale === "fr" ? "Bienvenue, invité" : "Welcome, guest",
    );
    await expect(
      page.getByText(locale === "fr" ? "Un roman" : "A novel", { exact: true }),
    ).toBeVisible();
    const nav = page.getByRole("navigation");
    await nav
      .getByRole("link", {
        name: locale === "fr" ? "Famille" : "Family",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/section=family/);
    await expect(
      page.getByRole("heading", {
        name: locale === "fr" ? "La famille de Camille" : "Camille’s family",
        exact: true,
      }),
    ).toBeVisible();
    await nav
      .getByRole("link", {
        name: locale === "fr" ? "Événements" : "Events",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/section=events/);
    await expect(
      page.getByRole("heading", {
        name:
          locale === "fr" ? "Anniversaire de Camille" : "Camille’s birthday",
        exact: true,
      }),
    ).toBeVisible();
    expect(await (await page.request.get("/api/auth/session")).json()).toBeNull();
    const viewport = page.viewportSize()!;
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);
    await page.goto(`/${locale}/dashboard/wishlists`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?next=`));
    await page.getByRole("link", { name: entry, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/guest$`));
    await page.goto(`/${locale}/register`);
    await page.getByRole("link", { name: entry, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/guest$`));
  });
}
