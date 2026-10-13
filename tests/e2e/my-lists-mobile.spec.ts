import { test, expect } from "@playwright/test";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
for (const [locale, m] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: compact lists, search and lifecycle remain accessible`, async ({
    page,
  }, info) => {
    test.skip(locale === "en" && info.project.name === "desktop");
    test.setTimeout(120_000);
    if (info.project.name === "mobile")
      await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(`/${locale}/register`);
    await page.locator('[name="name"]').fill("Mobile lists");
    await page
      .locator('[name="email"]')
      .fill(
        `mobile-lists-${locale}-${info.project.name}-${Date.now()}@example.test`,
      );
    await page.locator('[name="password"]').fill("Browser-test-2026!");
    await page
      .getByRole("button", { name: m.auth.signUp, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
    await page
      .getByRole("dialog")
      .getByRole("button", { name: m.tutorial.skip, exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    const root = `/${locale}/dashboard/wishlists`;
    for (const view of ["archived", "trash"]) {
      await page.goto(`${root}?view=${view}`);
      await expect(
        page.getByText(
          view === "archived"
            ? m.listNavigation.emptyArchive
            : m.listNavigation.emptyTrash,
          { exact: true },
        ),
      ).toBeVisible();
    }
    await page.request.post("/api/account-import", {
      data: {
        confirm: true,
        document: {
          version: 1,
          lists: [
            {
              name: "Noël",
              occasion: "Noël",
              neededBy: "2026-12-25",
              gifts: [],
            },
            { name: "Anniversaire", gifts: [] },
            {
              name: "Une très longue liste de cadeaux pour toute la famille et les proches",
              gifts: [],
            },
          ],
        },
      },
    });
    await page.goto(`/${locale}/dashboard`);
    await expect(page.locator("#incomplete-lists-heading")).toHaveCount(0);
    await expect(
      page
        .locator('[class*="listsCard"]')
        .getByRole("link", { name: m.wishlist.addItem, exact: true }),
    ).toHaveCount(3);
    await expect(
      page.getByRole("heading", {
        name: m.improvements.reminders,
        exact: true,
      }),
    ).toHaveCount(0);
    await page.goto(root);
    const mobile = info.project.name === "mobile";
    const card = page.locator('[class*="wishlistCard"]').filter({
      has: page.getByRole("heading", { name: "Noël", exact: true }),
    });
    const create = page.getByRole("link", {
      name: m.dashboard.newWishlist,
      exact: true,
    });
    await expect(create).toBeVisible();
    await expect(create).not.toHaveCSS("position", "fixed");
    await expect(
      page.getByText(m.wishlist.noGifts, { exact: true }),
    ).toHaveCount(3);
    if (mobile) {
      for (const width of [320, 360, 390, 430]) {
        await page.setViewportSize({ width, height: 740 });
        expect(
          await page
            .locator("#dashboard-scroll")
            .evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
        expect((await card.boundingBox())!.height).toBeLessThan(160);
      }
      await page.setViewportSize({ width: 390, height: 740 });
      await expect(
        card.getByRole("link", { name: m.wishlist.viewList, exact: true }),
      ).toBeHidden();
      const search = page.getByRole("button", {
        name: m.listNavigation.search,
        exact: true,
      });
      await search.click();
      const input = page.getByRole("searchbox", {
        name: m.listNavigation.search,
        exact: true,
      });
      await expect(input).toBeFocused();
      await input.fill("noel");
      await expect(page.locator('[class*="wishlistCard"]')).toHaveCount(1);
      const field = await input.locator("..").boundingBox(),
        toolbar = await search.locator("..").boundingBox();
      expect(field!.width).toBeGreaterThanOrEqual(toolbar!.width - 2);
      await page
        .getByRole("button", {
          name: m.listNavigation.closeSearch,
          exact: true,
        })
        .click();
      await expect(search).toBeFocused();
      await expect(input).toBeHidden();
      await search.click();
      await input.press("Escape");
      await expect(search).toBeFocused();
      await page.screenshot({ path: info.outputPath("my-lists-mobile.png") });
    } else {
      await expect(
        card.getByRole("link", { name: m.wishlist.viewList, exact: true }),
      ).toBeVisible();
    }
    const manage = page.getByLabel(`${m.listNavigation.manage} : Noël`, {
      exact: true,
    });
    await manage.click();
    await expect(page).toHaveURL(root);
    await expect(
      page.getByRole("button", { name: m.listLifecycle.archive, exact: true }),
    ).toBeVisible();
    await manage.click();
    if (mobile) {
      const bounds = await card.boundingBox();
      await card.click({
        position: { x: bounds!.width / 2, y: bounds!.height - 10 },
      });
    } else await card.getByRole("link", { name: "Noël", exact: true }).click();
    await expect(page).toHaveURL(/\/wishlists\/[^/?]+\?from=active$/);
    const print = page.getByRole("button", {
      name: m.wishlist.printList,
      exact: true,
    });
    const actions = page.locator("details.wishlist-actions");
    if (mobile) {
      await expect(print).toBeHidden();
      await expect(
        page.getByRole("navigation", { name: m.breadcrumbs.label }),
      ).toBeHidden();
      for (const width of [320, 390, 430]) {
        await page.setViewportSize({ width, height: 740 });
        expect(
          await page
            .locator("#dashboard-scroll")
            .evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
        const add = page.getByRole("button", {
          name: m.wishlist.addItem,
          exact: true,
        });
        await expect(add).toBeVisible();
        const bounds = await add.boundingBox();
        const bottom = await page.locator("#dashboard-scroll").boundingBox();
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
          bottom!.y + bottom!.height,
        );
      }
      await page.setViewportSize({ width: 390, height: 740 });
      await page.screenshot({
        path: info.outputPath("wishlist-detail-mobile.png"),
      });
      const triggerBefore = await actions
        .locator(":scope > summary")
        .boundingBox();
      const titleBefore = await page.locator("#list-gifts h1").boundingBox();
      await actions.locator(":scope > summary").click();
      await expect(print).toBeVisible();
      expect(await actions.locator(":scope > summary").boundingBox()).toEqual(
        triggerBefore,
      );
      expect(await page.locator("#list-gifts h1").boundingBox()).toEqual(
        titleBefore,
      );
      await page.keyboard.press("Escape");
      await expect(print).toBeHidden();
      await expect(actions.locator(":scope > summary")).toBeFocused();
      await actions.locator(":scope > summary").click();
      await page.locator("#list-gifts h1").click({ position: { x: 5, y: 5 } });
      await expect(print).toBeHidden();
      await actions.locator(":scope > summary").click();
      await page.evaluate(() => {
        window.print = () => {};
      });
      await print.click();
      await expect(print).toBeHidden();
    } else await expect(print).toBeVisible();
    await page
      .getByRole("button", { name: m.dailyFlow.changeVisibility, exact: true })
      .click();
    await expect(page.locator("select[name='visibility']")).toBeFocused();
    if (mobile) {
      await expect(page).toHaveURL(/manage=1&focus=visibility$/);
      await expect(page.locator("#list-gifts")).toHaveCount(0);
      await expect(
        page.getByRole("heading", {
          name: m.listNavigation.manageNamed.replace("{name}", "Noël"),
          exact: true,
        }),
      ).toBeVisible();
      for (const width of [320, 390, 430]) {
        await page.setViewportSize({ width, height: 740 });
        expect(
          await page
            .locator("#dashboard-scroll")
            .evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
      }
      await page.setViewportSize({ width: 390, height: 740 });
      await page
        .locator("#dashboard-scroll")
        .evaluate((el) => el.scrollTo(0, 0));
      await page.screenshot({
        path: info.outputPath("wishlist-management-mobile.png"),
      });
      await page
        .getByRole("button", { name: m.common.save, exact: true })
        .click();
      await expect(page).toHaveURL(/\/wishlists\/[^/?]+$/);
      await page.locator(".wishlist-actions > summary").click();
      await page
        .getByRole("link", { name: m.wishlist.editTitle, exact: true })
        .click();
      await page.locator("#list-name").fill("Unsaved name");
      await page
        .getByRole("button", { name: m.common.cancel, exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Noël", exact: true }),
      ).toBeVisible();
      await page.locator(".wishlist-actions > summary").click();
      await page
        .getByRole("link", { name: m.wishlist.editTitle, exact: true })
        .click();
      await expect(page.locator("#list-name")).toHaveValue("Noël");
      await page
        .getByRole("link", { name: m.listNavigation.backToList, exact: true })
        .click();
    } else
      await expect(page.locator("#list-settings")).toHaveAttribute("open", "");
    await page
      .getByRole("button", { name: m.wishlist.addItem, exact: true })
      .click();
    await expect(page.locator(".gift-editor")).toBeVisible();
    await page
      .getByRole("button", { name: m.common.cancel, exact: true })
      .click();
    await page.goto(root);
    await manage.click();
    await page
      .getByRole("button", { name: m.listLifecycle.archive, exact: true })
      .click();
    await expect(page).toHaveURL(`${root}?view=archived`);
    const tabs = page.getByRole("navigation", { name: m.listLifecycle.views });
    const help = page.getByText(m.listLifecycle.archiveHelp, { exact: true });
    expect((await help.boundingBox())!.y).toBeGreaterThanOrEqual(
      (await tabs.boundingBox())!.y + (await tabs.boundingBox())!.height,
    );
    await manage.click();
    await page
      .getByRole("button", { name: m.listLifecycle.restore, exact: true })
      .click();
    await expect(page).toHaveURL(root);
    page.on("dialog", (d) => d.accept());
    await manage.click();
    await page
      .getByRole("button", { name: m.listLifecycle.trash, exact: true })
      .click();
    await expect(page).toHaveURL(`${root}?view=trash`);
    await expect(
      page.getByRole("heading", { name: "Noël", exact: true }),
    ).toBeVisible();
    await manage.click();
    await page
      .getByRole("button", { name: m.listLifecycle.restore, exact: true })
      .click();
    await expect(page).toHaveURL(root);
    await create.click();
    await expect(page).toHaveURL(`${root}/create`);
  });
}
