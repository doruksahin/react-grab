import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures.js";

/**
 * Hiding one revealed selection from the comments panel must leave the
 * other revealed selection's pin mounted. Pins used to be removed and
 * re-added on every change to the selections, and listed by position, which
 * replayed their entry animation (the "flash"). Both orders are covered, so
 * the test does not depend on which pin comes first.
 */

const NAV = "Navigation bar is misaligned";
const LOGO = "Logo overlaps";

const pins = (page: Page) => page.locator("[data-react-grab-collapsed-dot]");
const pinFor = (page: Page, text: string) =>
  pins(page).filter({ hasText: text });
const panelRow = (page: Page, text: string) =>
  page
    .locator(
      "[data-react-grab-comments-dropdown] [data-react-grab-comment-item]",
    )
    .filter({ hasText: text });

test.describe(
  "Reveal toggle keeps other selections mounted",
  { tag: ["@SPEC-010", "@ADR-0022"] },
  () => {
    test.beforeEach(async ({ reactGrab }) => {
      await reactGrab.populate();
      await expect
        .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
        .toBe(true);
    });

    for (const [hidden, kept] of [
      [NAV, LOGO],
      [LOGO, NAV],
    ] as const) {
      test(
        `hiding "${hidden}" leaves the "${kept}" pin as the same element`,
        {
          annotation: {
            type: "ac",
            description:
              "SPEC-010: revealed selections stay anchored; a reveal toggle redraws only the toggled selection",
          },
        },
        async ({ page, reactGrab }) => {
          await expect(pins(page)).toHaveCount(2);
          await pinFor(page, kept).evaluate((element) =>
            element.setAttribute("data-e2e-kept", "original"),
          );

          await reactGrab.clickCommentsButton();
          const row = panelRow(page, hidden);
          await row.hover();
          await row
            .getByRole("button", { name: "Hide this selection" })
            .click();

          await expect(pins(page)).toHaveCount(1);
          await expect(pinFor(page, kept)).toHaveAttribute(
            "data-e2e-kept",
            "original",
          );
        },
      );
    }
  },
);
