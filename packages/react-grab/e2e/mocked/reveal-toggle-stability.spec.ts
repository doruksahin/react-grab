import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures.js";

/**
 * Hiding one revealed selection from the comments panel must leave the
 * other revealed selections' pins mounted. They used to be removed and
 * re-added on every change to the selections, which replayed their entry
 * animation (the "flash").
 */

const pins = (page: Page) => page.locator("[data-react-grab-collapsed-dot]");
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

    test(
      "hiding one selection leaves the other's pin as the same element",
      {
        annotation: {
          type: "ac",
          description:
            "SPEC-010: revealed selections stay anchored; a reveal toggle redraws only the toggled selection",
        },
      },
      async ({ page, reactGrab }) => {
        await expect(pins(page)).toHaveCount(2);
        const logoPin = pins(page).filter({ hasText: "Logo overlaps" });
        await logoPin.evaluate((element) =>
          element.setAttribute("data-e2e-kept", "original"),
        );

        await reactGrab.clickCommentsButton();
        const navRow = panelRow(page, "Navigation bar is misaligned");
        await navRow.hover();
        await navRow
          .getByRole("button", { name: "Hide this selection" })
          .click();
        await reactGrab.screenshot("after-hiding-one", "page");

        await expect(pins(page)).toHaveCount(1);
        await expect(
          pins(page).filter({ hasText: "Logo overlaps" }),
        ).toHaveAttribute("data-e2e-kept", "original");
      },
    );
  },
);
