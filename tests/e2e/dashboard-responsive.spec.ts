import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";

test("dashboard adapts to wide screens, tablets and narrow phones", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Viewports are covered within this test",
  );
  test.setTimeout(180_000);
  await page.goto("/fr/register");
  await page.locator('[name="name"]').fill("Responsive");
  await page
    .locator('[name="email"]')
    .fill(`responsive-${Date.now()}@example.test`);
  await page.locator('[name="password"]').fill("Browser-test-2026!");
  await page.getByRole("button", { name: fr.auth.signUp, exact: true }).click();
  await expect(page).toHaveURL(/\/fr\/dashboard$/);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: fr.tutorial.skip, exact: true })
    .click();

  const imported = await page.request.post("/api/account-import", {
    data: {
      confirm: true,
      document: {
        version: 1,
        lists: [
          {
            name: "Anniversaire et envies à partager avec toute la famille",
            gifts: [{ title: "Livre" }],
          },
          { name: "Noël", gifts: [{ title: "Jeu" }] },
          { name: "Voyage", gifts: [] },
          { name: "Maison", gifts: [] },
        ],
      },
    },
  });
  expect(imported.status()).toBe(200);

  for (const width of [2560, 820, 320]) {
    await page.setViewportSize({ width, height: width === 2560 ? 1260 : 900 });
    for (const route of [
      "",
      "/wishlists",
      "/gift-ideas",
      "/reservations",
      "/family",
      "/events",
    ]) {
      await page.goto(`/fr/dashboard${route}`);
      await expect(page.locator("main h1")).toBeVisible();
      const scroll = page.locator("#dashboard-scroll");
      const sizes = await scroll.evaluate((element) => ({
        width: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(
        sizes.scrollWidth,
        `${route} at ${width}px overflows`,
      ).toBeLessThanOrEqual(sizes.width + 1);
      const clipped = await page.locator("main").evaluate((main) => {
        const bounds = main.getBoundingClientRect();
        return [
          ...main.querySelectorAll("input, select, button, .primary-link"),
        ]
          .filter((element) => element.getClientRects().length > 0)
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.left < bounds.left - 1 || rect.right > bounds.right + 1;
          })
          .map((element) => element.textContent || element.tagName);
      });
      expect(clipped, `${route} at ${width}px clips controls`).toEqual([]);

      if (route === "") {
        const lists = await page.locator('[class*="listsCard"]').boundingBox();
        const supporting = await page
          .locator('[class*="supporting"]')
          .boundingBox();
        expect(lists!.width).toBeGreaterThan(width === 2560 ? 800 : 200);
        if (width === 2560)
          expect(supporting!.x).toBeGreaterThan(lists!.x + lists!.width);
        else expect(supporting!.y).toBeGreaterThan(lists!.y);
      }
      if (route === "/reservations") {
        const budget = page.locator(".gift-budget-card");
        const bounds = await budget.boundingBox();
        expect(bounds!.width).toBeLessThanOrEqual(640);
        if (width === 2560) {
          const reservations = await page
            .locator('[class*="reservations"]')
            .first()
            .boundingBox();
          expect(bounds!.x).toBeGreaterThan(reservations!.x);
        }
        if (
          !(await budget
            .locator("details")
            .evaluate((element) => (element as HTMLDetailsElement).open))
        ) {
          await budget.locator("summary").click();
        }
        await expect(
          page.getByText(fr.giftBudget.privacy, { exact: true }),
        ).toHaveCount(1);
        await page.getByLabel(fr.giftBudget.amount, { exact: true }).fill("80");
        await page
          .getByRole("button", { name: fr.giftBudget.save, exact: true })
          .click();
        await expect(
          page.getByRole("status").filter({ hasText: fr.giftBudget.saved }),
        ).toBeVisible();
      }
      if ((route === "" || route === "/reservations") && width !== 820) {
        await page.screenshot({
          path: info.outputPath(
            `${route ? "reservations" : "home"}-${width}.png`,
          ),
          fullPage: true,
        });
      }
    }
  }
});
