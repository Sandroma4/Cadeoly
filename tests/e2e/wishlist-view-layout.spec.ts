import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";

test("archive and trash explanations stay below tabs with or without lists", async ({
  page,
}, info) => {
  if (info.project.name === "desktop")
    await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/fr/register");
  await page.locator('[name="name"]').fill("Layout");
  await page
    .locator('[name="email"]')
    .fill(`views-${info.project.name}-${Date.now()}@example.test`);
  await page.locator('[name="password"]').fill("Browser-test-2026!");
  await page.getByRole("button", { name: fr.auth.signUp, exact: true }).click();
  await expect(page).toHaveURL(/\/fr\/dashboard$/);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: fr.tutorial.skip, exact: true })
    .click();

  async function checkHelp(view: "archived" | "trash") {
    await expect(page).toHaveURL(new RegExp(`view=${view}$`));
    const tabs = page.getByRole("navigation", { name: fr.listLifecycle.views });
    const help = page.getByText(
      view === "archived"
        ? fr.listLifecycle.archiveHelp
        : fr.listLifecycle.trashHelp,
      { exact: true },
    );
    await expect(help).toBeVisible();
    const tabBounds = await tabs.boundingBox();
    const helpBounds = await help.boundingBox();
    expect(helpBounds!.y).toBeGreaterThanOrEqual(
      tabBounds!.y + tabBounds!.height,
    );
    expect(
      await help.evaluate((element) => element.closest("main")!.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
  }

  for (const view of ["archived", "trash"] as const) {
    await page.goto(`/fr/dashboard/wishlists?view=${view}`);
    await checkHelp(view);
    if (view === "archived") {
      await expect(
        page.locator('[class*="emptyCard"] .primary-link'),
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", {
          name: fr.listLifecycle.activeTab,
          exact: true,
        }),
      ).toBeVisible();
    }
  }

  const install = page.getByLabel(fr.installApp.button, { exact: true });
  await expect(install).toBeVisible();
  await expect(install).toHaveCSS(
    "min-height",
    info.project.name === "desktop" ? "48px" : "40px",
  );
  if (info.project.name === "desktop") {
    await expect(install).toHaveCSS("column-gap", "10px");
    await expect(install.locator("svg")).toHaveCSS("width", "20px");
    await install.click();
    await expect(
      page.getByText(fr.installApp.help, { exact: true }),
    ).toBeVisible();
    await install.click();
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(event, {
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: "dismissed" }),
      });
      window.dispatchEvent(event);
    });
    const installButton = page.getByRole("button", {
      name: fr.installApp.button,
      exact: true,
    });
    await expect(installButton).toHaveCSS("min-height", "48px");
    await expect(installButton).toHaveCSS("column-gap", "10px");
    await installButton.screenshot({
      path: info.outputPath("install-desktop.png"),
    });
  }
  expect(
    (
      await page.request.post("/api/account-import", {
        data: {
          confirm: true,
          document: { version: 1, lists: [{ name: "Layout list", gifts: [] }] },
        },
      })
    ).status(),
  ).toBe(200);
  page.on("dialog", (dialog) => dialog.accept());
  for (const [view, action] of [
    ["archived", fr.listLifecycle.archive],
    ["trash", fr.listLifecycle.trash],
  ] as const) {
    await page.goto(
      `/fr/dashboard/wishlists?view=${view === "trash" ? "archived" : "active"}`,
    );
    await page
      .getByLabel(`${fr.listNavigation.manage} : Layout list`, {
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: action, exact: true }).click();
    await checkHelp(view);
    await expect(
      page.getByRole("heading", { name: "Layout list", exact: true }),
    ).toBeVisible();
  }

  for (const route of ["family", "events"]) {
    await page.goto(`/fr/dashboard/${route}`);
    const card = page.locator('[class*="emptyCard"]');
    const main = page.locator("#dashboard-scroll > :last-child");
    const cardBounds = await card.boundingBox();
    const mainBounds = await main.boundingBox();
    expect(cardBounds!.width).toBeGreaterThanOrEqual(mainBounds!.width - 2);
    if (route === "family")
      await page.screenshot({ path: info.outputPath("family.png") });
  }
});
