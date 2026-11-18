import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures.js";

/**
 * Hovering a selection in the sidebar opens its card on the page, the way
 * hovering its row in the comments panel does. Opening the sidebar shows the
 * selections as pins, so the hover opens the pin's card.
 */

const dashboard = (page: Page) =>
  page.getByRole("dialog", { name: "React Grab Dashboard" });
const pageCards = (page: Page) =>
  page.locator("[data-react-grab-selection-label]");

test.describe("Sidebar selection hover", { tag: ["@ADR-0028"] }, () => {
  test.beforeEach(async ({ page, reactGrab, mockServer: _mockServer }) => {
    await reactGrab.triggerInitSync();
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);
    await reactGrab.clickCommentsButton();
    await page.locator("[data-react-grab-comments-open-sidebar]").click();
    await expect(dashboard(page)).toBeVisible();
    await page.mouse.move(0, 0);
  });

  test("hovering a sidebar row opens its card on the page until the pointer leaves", async ({
    page,
  }) => {
    await expect(pageCards(page)).toHaveCount(0);

    await dashboard(page)
      .locator("[data-react-grab-selection-row]")
      .first()
      .hover();
    await expect(pageCards(page)).toHaveCount(1);

    await page.mouse.move(0, 0);
    await expect(pageCards(page)).toHaveCount(0);
  });
});
