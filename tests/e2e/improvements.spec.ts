import { test, expect } from "@playwright/test";
import sharp from "sharp";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
for (const [locale, t] of [
  ["fr", fr],
  ["en", en],
] as const) {
  test(`${locale}: restore preview, recipient lifecycle, pagination, links and keyboard access`, async ({
    page,
    request,
  }, info) => {
    expect(
      (await request.post("/api/account-import", { data: {} })).status(),
    ).toBe(401);
    await page.goto(`/${locale}/register`);
    await page.locator('input[name="name"]').fill("Restore owner");
    await page
      .locator('input[name="email"]')
      .fill(
        `restore-${info.project.name}-${locale}-${Date.now()}@example.test`,
      );
    await page.locator('input[name="password"]').fill("Browser-test-2026!");
    await page
      .getByRole("button", { name: t.auth.signUp, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
    // The welcome tutorial holds keyboard focus until it is dismissed.
    await page
      .getByRole("dialog")
      .getByRole("button", { name: t.tutorial.skip, exact: true })
      .click();
    // An empty reminders panel is hidden on a brand-new account.
    await expect(
      page.getByRole("heading", { name: t.improvements.reminders }),
    ).toHaveCount(0);
    await page.goto(`/${locale}/dashboard`);
    // The dashboard streams in after its loading skeleton; wait for the real content.
    await expect(page.locator("#dashboard-content")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: t.improvements.skip }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#dashboard-content")).toBeFocused();
    // On mobile the profile is split into sections; import lives under "data".
    await page.goto(`/${locale}/dashboard/profile?section=data`);
    expect(
      (
        await page.request.post("/api/account-import", {
          data: { document: { version: 1, lists: [] } },
          headers: { Origin: "https://foreign.example" },
        })
      ).status(),
    ).toBe(403);
    const photo = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#685599" },
    })
      .webp()
      .toBuffer();
    const document = {
      version: 1,
      lists: [
        {
          name: "Restored list",
          visibility: "PUBLIC",
          shareToken: "exclude-me",
          recipient: { name: "Child" },
          gifts: Array.from({ length: 25 }, (_, i) => ({
            title: `Gift ${String(i + 1).padStart(2, "0")}`,
            priceCents: 1000,
            currency: "EUR",
            priority: "NORMAL",
            url: "https://127.0.0.1/blocked",
            ...(i === 0
              ? {
                  photo: {
                    mimeType: "image/webp",
                    base64: photo.toString("base64"),
                  },
                }
              : {}),
          })),
        },
      ],
    };
    // The file picker only enables "check" once hydrated.
    await page.waitForLoadState("networkidle");
    await page.getByLabel(t.improvements.importFile).setInputFiles({
      name: "personal.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(document)),
    });
    await page
      .getByRole("button", { name: t.improvements.previewImport })
      .click();
    await expect(
      page.getByRole("heading", { name: t.improvements.importPreview }),
    ).toBeVisible();
    expect(
      (await (await page.request.get("/api/account-export")).json()).lists,
    ).toHaveLength(0);
    await page
      .getByRole("button", { name: t.improvements.confirmImport })
      .click();
    await expect(
      page.getByText(
        t.improvements.imported
          .replace("{lists}", "1")
          .replace("{gifts}", "25"),
        { exact: true },
      ),
    ).toBeVisible();
    let exported = await (await page.request.get("/api/account-export")).json();
    expect(exported.lists).toHaveLength(1);
    expect(exported.lists[0].visibility).toBe("PRIVATE");
    expect(
      exported.lists[0].gifts.filter((g: { photo: unknown }) => g.photo),
    ).toHaveLength(1);
    await page.goto(`/${locale}/dashboard/profile?section=people`);
    const child = page
      .locator("details.recipient-row")
      .filter({ has: page.locator("summary", { hasText: /^Child$/ }) });
    await child.locator("summary").click();
    await child
      .getByLabel(t.improvements.renameRecipient)
      .fill("Renamed child");
    await child
      .getByRole("button", { name: t.improvements.rename, exact: true })
      .click();
    await expect(
      page
        .locator("details.recipient-row > summary")
        .filter({ hasText: /^Renamed child$/ }),
    ).toBeVisible();
    // The add-person form is now behind a collapsed disclosure.
    await page
      .locator("summary", { hasText: t.profileSettings.addPerson })
      .click();
    await page
      .getByLabel(t.convenience.recipientName, { exact: true })
      .fill("Sibling");
    await page
      .getByRole("button", { name: t.convenience.addRecipient, exact: true })
      .click();
    await expect(
      page
        .locator("details.recipient-row > summary")
        .filter({ hasText: /^Sibling$/ }),
    ).toBeVisible();
    const renamed = page
      .locator("details.recipient-row")
      .filter({ has: page.locator("summary", { hasText: /^Renamed child$/ }) });
    if (
      !(await renamed
        .getByRole("button", { name: t.improvements.merge, exact: true })
        .isVisible())
    )
      await renamed.locator("summary").click();
    page.once("dialog", (dialog) => dialog.accept());
    await renamed
      .getByRole("button", { name: t.improvements.merge, exact: true })
      .click();
    await expect(
      page
        .locator("details.recipient-row > summary")
        .filter({ hasText: /^Renamed child$/ }),
    ).toHaveCount(0);
    exported = await (await page.request.get("/api/account-export")).json();
    expect(exported.lists[0].recipient.name).toBe("Sibling");
    const sibling = page.locator("details.recipient-row");
    await sibling.locator("summary").click();
    page.once("dialog", (dialog) => dialog.accept());
    await sibling
      .getByRole("button", {
        name: t.improvements.deleteRecipient,
        exact: true,
      })
      .click();
    await expect(page.locator("details.recipient-row")).toHaveCount(0);
    exported = await (await page.request.get("/api/account-export")).json();
    expect(exported.lists[0].recipient).toBeNull();
    await page.goto(`/${locale}/dashboard/wishlists/${exported.lists[0].id}`);
    await expect(page.locator(".gift-grid > div")).toHaveCount(24);
    await expect(
      page.getByRole("heading", { name: "Restored list", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/improvements-${info.project.name}-${locale}.png`,
    });
    await page
      .getByRole("button", { name: t.improvements.next, exact: true })
      .click();
    await expect(page.locator(".gift-grid > div")).toHaveCount(1);
    // Link checks now sit in the card's collapsed "link tools" panel.
    await page
      .locator(".gift-details-panel > summary", {
        hasText: t.wishlist.linkTools,
      })
      .first()
      .click();
    await page
      .getByRole("button", { name: t.improvements.checkLinks, exact: true })
      .click();
    await expect(
      page.getByText(
        new RegExp(
          t.improvements.linkUnknown.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        ),
      ),
    ).toBeVisible();
    await page
      .getByRole("button", { name: t.improvements.previous, exact: true })
      .click();
    await expect(page.locator(".gift-grid > div")).toHaveCount(24);
    await page.locator('input[type="search"]').fill("Gift 01");
    await expect(page.locator(".gift-grid > div")).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: t.improvements.next, exact: true }),
    ).toHaveCount(0);
    const overflow = await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth > innerWidth,
    );
    expect(overflow).toBe(false);
  });
}
