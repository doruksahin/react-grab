import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures.js";

/**
 * ADR-0022 step 3, Label board S6.1/S6.2: a saved comment shows on the page
 * as a pin; it opens a card, and the card's "Open thread" opens the sidebar
 * on the selection's group, where the Jira thread lives.
 */

const pins = (page: Page) => page.locator("[data-react-grab-collapsed-dot]");

test.describe("Label pins", { tag: ["@ADR-0022"] }, () => {
  test.beforeEach(async ({ reactGrab, mockServer: _mockServer }) => {
    await reactGrab.triggerInitSync();
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);
  });

  test(
    "saved comments show as pins that do not overlap",
    { annotation: { type: "ac", description: "Label S6.1: collapsed pins" } },
    async ({ page }) => {
      await expect(pins(page)).toHaveCount(2);
      await expect(
        page.locator("[data-react-grab-selection-label]"),
      ).toHaveCount(0);
      await expect(pins(page).first()).toContainText("ATT-101");
      await expect(pins(page).first()).toHaveAttribute(
        "aria-expanded",
        "false",
      );

      const [first, second] = await Promise.all([
        pins(page).nth(0).boundingBox(),
        pins(page).nth(1).boundingBox(),
      ]);
      if (!first || !second) throw new Error("pins have no box");
      const overlaps =
        first.x < second.x + second.width &&
        second.x < first.x + first.width &&
        first.y < second.y + second.height &&
        second.y < first.y + first.height;
      expect(overlaps).toBe(false);
    },
  );

  test(
    "a pin opens its card, and Open thread opens the sidebar on that selection",
    {
      annotation: {
        type: "ac",
        description: "Label S6.2: card, the thread lives in the sidebar",
      },
    },
    async ({ page }) => {
      const pin = pins(page).filter({ hasText: "Navigation bar" });
      await pin.click();
      await expect(pin).toHaveAttribute("aria-expanded", "true");

      const card = page
        .locator("[data-react-grab-selection-label]")
        .filter({ hasText: "Navigation bar is misaligned" });
      await expect(card).toBeVisible();
      // The card shows the latest comment, not the editor.
      await expect(
        card.locator("[data-react-grab-latest-comment]"),
      ).toBeVisible();
      await expect(
        card.locator("[data-react-grab-comment-composer]"),
      ).toHaveCount(0);

      await card.getByRole("button", { name: "Open thread" }).click();
      const dashboard = page.getByRole("dialog", {
        name: "React Grab Dashboard",
      });
      await expect(dashboard).toBeVisible();
      await expect(
        dashboard.getByRole("tab", { name: /^Selections/ }),
      ).toHaveAttribute("aria-selected", "true");
      const thread = dashboard
        .locator("[data-react-grab-selection-card]")
        .filter({ hasText: "Navigation bar is misaligned" });
      await expect(
        thread.locator("[data-react-grab-comment-composer]").first(),
      ).toBeInViewport();
    },
  );
});
