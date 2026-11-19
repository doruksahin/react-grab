import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures.js";

/**
 * ADR-0028: the comments menu is the quick list; the sidebar holds each
 * selection's full card. A row's click and the menu's header open it there,
 * and the row's eye only shows or hides the selection on the page.
 */

const SELECTION = "Navigation bar is misaligned on mobile viewports";

const panel = (page: Page) =>
  page.locator("[data-react-grab-comments-dropdown]");
const row = (page: Page) =>
  panel(page)
    .locator("[data-react-grab-comment-item]")
    .filter({ hasText: SELECTION });
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

  test("a row's click opens the sidebar on that selection's card", async ({
    page,
  }) => {
    await row(page).click();

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

  test("the keyboard opens it too: Enter on the focused row", async ({
    page,
  }) => {
    await row(page).locator("[data-react-grab-comment-item-open]").focus();
    await page.keyboard.press("Enter");

    await expect(dashboard(page)).toBeVisible();
    await expect(panel(page)).toHaveCount(0);
  });

  test("the row's eye toggles visibility and does not open the sidebar", async ({
    page,
  }) => {
    const eye = row(page).locator("[data-react-grab-comment-item-reveal]");
    const before = await eye.getAttribute("aria-pressed");
    await eye.click();

    await expect(eye).not.toHaveAttribute("aria-pressed", before ?? "");
    await expect(panel(page)).toBeVisible();
    await expect(dashboard(page)).toHaveCount(0);
  });

  test("the row's menu no longer has Open in sidebar", async ({ page }) => {
    await row(page).hover();
    await row(page).getByRole("button", { name: "Selection actions" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Open in sidebar" }),
    ).toHaveCount(0);
  });

  test("the header opens the sidebar", async ({ page }) => {
    await panel(page)
      .locator("[data-react-grab-comments-open-sidebar]")
      .click();
    await expect(dashboard(page)).toBeVisible();
    await expect(panel(page)).toHaveCount(0);
  });
});
