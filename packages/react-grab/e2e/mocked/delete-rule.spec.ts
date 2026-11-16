import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures.js";
import type { CommentItem } from "../../src/types.js";
import type { SelectionGroupWithJira } from "../../src/features/selection-groups/types.js";
import { comments as fixtureComments } from "../mocks/fixtures.js";
import { openGroupDetail } from "../open-group-detail.js";

/**
 * ADR-0008, amended 2026-11-16: a selection without a ticket can be
 * deleted; a selection with a ticket cannot, by any path.
 */

const groups: SelectionGroupWithJira[] = [
  { id: "open", name: "Open work", createdAt: 1, revealed: false },
  {
    id: "ticketed",
    name: "Shipped",
    createdAt: 2,
    revealed: false,
    jiraTicketId: "SCRUM-3",
  },
];

const [base] = fixtureComments;
const selection = (
  id: string,
  groupId: string,
  commentText: string,
): CommentItem => ({
  ...base,
  id,
  groupId,
  commentText,
  jiraTicketId: undefined,
  status: "open",
});

const selections = [
  selection("free", "open", "No ticket yet"),
  selection("locked", "ticketed", "Has a ticket"),
];

const panelRow = (page: Page, text: string) =>
  page
    .locator(
      "[data-react-grab-comments-dropdown] [data-react-grab-comment-item]",
    )
    .filter({ hasText: text });

test.describe(
  "Deleting selections",
  { tag: ["@SPEC-011", "@ADR-0008"] },
  () => {
    test.beforeEach(async ({ reactGrab }) => {
      await reactGrab.populate({ groups, comments: selections });
      await expect
        .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
        .toBe(true);
    });

    test("Clear all deletes only the selections without a ticket", async ({
      page,
      reactGrab,
    }) => {
      await reactGrab.clickCommentsButton();
      const clear = page.locator("[data-react-grab-comments-clear]");
      await expect(clear).toHaveAttribute(
        "aria-label",
        "Clear comments without a ticket",
      );

      await clear.click();
      await expect
        .poll(() => reactGrab.isCommentsDropdownVisible())
        .toBe(false);
      await reactGrab.clickCommentsButton();

      await expect(panelRow(page, "Has a ticket")).toHaveCount(1);
      await expect(panelRow(page, "No ticket yet")).toHaveCount(0);
    });

    test("Clear all is not offered when every selection has a ticket", async ({
      page,
      reactGrab,
    }) => {
      await reactGrab.populate({
        groups,
        comments: [selection("locked", "ticketed", "Has a ticket")],
      });
      await reactGrab.clickCommentsButton();
      await expect(panelRow(page, "Has a ticket")).toHaveCount(1);
      await expect(
        page.locator("[data-react-grab-comments-clear]"),
      ).toHaveCount(0);
    });

    test("a selection with a ticket has no remove action on its card", async ({
      page,
    }) => {
      await page.locator("[data-react-grab-toolbar-dashboard]").click();
      await openGroupDetail(page, "Shipped");
      const lockedCard = page
        .locator("[data-react-grab-selection-card]")
        .filter({ hasText: "Has a ticket" });
      await expect(lockedCard).toBeVisible();
      await expect(
        lockedCard.getByRole("button", { name: "Selection actions" }),
      ).toHaveCount(0);
    });

    test("a selection without a ticket can be removed from its card", async ({
      page,
    }) => {
      await page.locator("[data-react-grab-toolbar-dashboard]").click();
      await openGroupDetail(page, "Open work");
      const freeCard = page
        .locator("[data-react-grab-selection-card]")
        .filter({ hasText: "No ticket yet" });
      await freeCard.getByRole("button", { name: "Selection actions" }).click();
      await page.getByRole("menuitem", { name: "Remove selection" }).click();
      await expect(freeCard).toHaveCount(0);
    });

    test("Copy all does not offer to clear when every selection has a ticket", async ({
      page,
      reactGrab,
    }) => {
      await reactGrab.populate({
        groups,
        comments: [selection("locked", "ticketed", "Has a ticket")],
      });
      await reactGrab.clickCommentsButton();
      await page.locator("[data-react-grab-comments-copy-all]").click();
      await expect(
        page.locator("[data-react-grab-clear-comments-prompt]"),
      ).toHaveCount(0);
      await expect(panelRow(page, "Has a ticket")).toHaveCount(1);
    });

    test("a comment panel row removes a selection without a ticket", async ({
      page,
      reactGrab,
    }) => {
      await reactGrab.clickCommentsButton();
      const free = panelRow(page, "No ticket yet");
      await free.hover();
      await free.getByRole("button", { name: "Remove selection" }).click();
      await expect(free).toHaveCount(0);
      await expect(panelRow(page, "Has a ticket")).toHaveCount(1);
    });

    test("a comment panel row offers no removal for a selection with a ticket", async ({
      page,
      reactGrab,
    }) => {
      await reactGrab.clickCommentsButton();
      const locked = panelRow(page, "Has a ticket");
      await locked.hover();
      await expect(
        locked.getByRole("button", { name: "Remove selection" }),
      ).toHaveCount(0);
    });

    test("a sidebar card removes a selection without a ticket", async ({
      page,
      reactGrab,
    }) => {
      await reactGrab.populate({
        groups,
        comments: [
          { ...selection("loose", "open", "Loose one"), groupId: null },
          selection("locked", "ticketed", "Has a ticket"),
        ],
      });
      await page.locator("[data-react-grab-toolbar-dashboard]").click();
      const card = page
        .locator("[data-react-grab-selection-card]")
        .filter({ hasText: "Loose one" });
      await card.getByRole("button", { name: "Selection actions" }).click();
      await page.getByRole("menuitem", { name: "Remove selection" }).click();
      await expect(card).toHaveCount(0);
    });
  },
);
