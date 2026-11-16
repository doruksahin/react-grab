import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures.js";

/**
 * ADR-0028: the comments menu is the quick list; the sidebar holds each
 * selection's full card. A row's menu and the menu's header open it there.
 */

const SELECTION = "Navigation bar is misaligned on mobile viewports";

const panel = (page: Page) =>
  page.locator("[data-react-grab-comments-dropdown]");
const dashboard = (page: Page) =>
  page.getByRole("dialog", { name: "React Grab Dashboard" });

test.describe("Open in sidebar", { tag: ["@ADR-0028"] }, () => {
  test.beforeEach(async ({ reactGrab, mockServer: _mockServer }) => {
    await reactGrab.triggerInitSync();
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);
    await reactGrab.clickCommentsButton();
  });

  test("a row's menu opens the sidebar on that selection's card", async ({
    page,
  }) => {
    const row = panel(page)
      .locator("[data-react-grab-comment-item]")
      .filter({ hasText: SELECTION });
    await row.hover();
    await row.getByRole("button", { name: "Selection actions" }).click();
    await page.getByRole("menuitem", { name: "Open in sidebar" }).click();

    await expect(dashboard(page)).toBeVisible();
    await expect(panel(page)).toHaveCount(0);
    const card = dashboard(page)
      .locator("[data-react-grab-selection-card]")
      .filter({ hasText: SELECTION });
    await expect(
      card.locator("[data-react-grab-selection-row]"),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(
      card.locator("[data-react-grab-selection-card-body]"),
    ).toBeInViewport();
  });

  test("the header opens the sidebar", async ({ page }) => {
    await panel(page)
      .locator("[data-react-grab-comments-open-sidebar]")
      .click();
    await expect(dashboard(page)).toBeVisible();
    await expect(panel(page)).toHaveCount(0);
  });
});
