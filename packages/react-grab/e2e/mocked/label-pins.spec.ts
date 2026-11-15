import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures.js";

/**
 * ADR-0022 step 3, Label board S6.1/S6.2: a saved comment shows on the page
 * as a pin; it opens a card under the pin, and the card's "Open thread"
 * opens the sidebar on that selection, where the Jira thread lives.
 */

const pins = (page: Page) => page.locator("[data-react-grab-collapsed-dot]");
const navPin = (page: Page) => pins(page).filter({ hasText: "Navigation bar" });
const navCard = (page: Page) =>
  page
    .locator("[data-react-grab-selection-label]")
    .filter({ hasText: "Navigation bar is misaligned" });

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (!box) throw new Error("element has no box");
  return box;
};

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

      const first = await boxOf(pins(page).nth(0));
      const second = await boxOf(pins(page).nth(1));
      const overlaps =
        first.x < second.x + second.width &&
        second.x < first.x + first.width &&
        first.y < second.y + second.height &&
        second.y < first.y + first.height;
      expect(overlaps).toBe(false);
    },
  );

  test(
    "a pin opens its card under it, and Open thread opens the sidebar on that selection",
    {
      annotation: {
        type: "ac",
        description: "Label S6.2: card, the thread lives in the sidebar",
      },
    },
    async ({ page }) => {
      await navPin(page).click();
      await expect(navPin(page)).toHaveAttribute("aria-expanded", "true");
      await expect(navCard(page)).toBeVisible();

      const pin = await boxOf(navPin(page));
      const card = await boxOf(navCard(page));
      expect(card.y).toBeGreaterThanOrEqual(pin.y + pin.height);
      // Start-aligned to the pin (the card keeps a small inset for its arrow).
      expect(Math.abs(card.x - pin.x)).toBeLessThanOrEqual(8);

      // The card shows the latest comment, not the editor.
      await expect(
        navCard(page).locator("[data-react-grab-latest-comment]"),
      ).toContainText("Same here on Firefox");
      await expect(
        navCard(page).locator("[data-react-grab-comment-composer]"),
      ).toHaveCount(0);

      await navCard(page).getByRole("button", { name: "Open thread" }).click();
      const dashboard = page.getByRole("dialog", {
        name: "React Grab Dashboard",
      });
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

  test(
    "the card opens above its pin when there is no room below",
    {
      annotation: {
        type: "ac",
        description: "ADR-0022 step 3: the card anchors to the pin and flips",
      },
    },
    async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 480 });
      await navPin(page).click();
      await expect(navCard(page)).toBeVisible();

      const pin = await boxOf(navPin(page));
      const card = await boxOf(navCard(page));
      expect(card.y + card.height).toBeLessThanOrEqual(pin.y + 1);
      expect(card.x).toBeLessThan(pin.x + pin.width);
      expect(card.x + card.width).toBeGreaterThan(pin.x);
    },
  );

  test(
    "hovering a comment in the comments menu opens its pin's card without a second pin",
    {
      annotation: {
        type: "ac",
        description: "ADR-0022 step 3: menu preview reuses the pin",
      },
    },
    async ({ page, reactGrab }) => {
      await expect(pins(page)).toHaveCount(2);
      // Measure once the pins' entry animation has finished.
      await expect
        .poll(async () => (await boxOf(pins(page).nth(1))).width)
        .toBe(240);
      const before = await Promise.all([
        boxOf(pins(page).nth(0)),
        boxOf(pins(page).nth(1)),
      ]);

      await reactGrab.clickCommentsButton();
      await expect
        .poll(() => reactGrab.isCommentsDropdownVisible(), { timeout: 2000 })
        .toBe(true);
      await reactGrab.hoverCommentItem(0);

      await expect(
        page.locator("[data-react-grab-selection-label]"),
      ).toHaveCount(1);
      await expect(pins(page)).toHaveCount(2);
      // Same pins in the same places (polled past any entry animation).
      await expect
        .poll(() =>
          Promise.all([boxOf(pins(page).nth(0)), boxOf(pins(page).nth(1))]),
        )
        .toEqual(before);
    },
  );

  test(
    "keyboard: Enter on a pin, Enter on Open thread, Escape returns to the pin",
    {
      annotation: {
        type: "ac",
        description: "ADR-0022 step 3: focus moves to the thread and back",
      },
    },
    async ({ page }) => {
      await navPin(page).focus();
      await page.keyboard.press("Enter");
      await expect(navCard(page)).toBeVisible();

      const openThread = navCard(page).getByRole("button", {
        name: "Open thread",
      });
      await openThread.focus();
      await page.keyboard.press("Enter");

      const dashboard = page.getByRole("dialog", {
        name: "React Grab Dashboard",
      });
      const thread = dashboard
        .locator("[data-react-grab-selection-card]")
        .filter({ hasText: "Navigation bar is misaligned" });
      await expect(thread).toBeFocused();

      await page.keyboard.press("Escape");
      await expect(dashboard).toHaveCount(0);
      await expect(navPin(page)).toBeFocused();
    },
  );
});
