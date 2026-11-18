import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures.js";
import type { CommentItem } from "../../src/types.js";
import type { SelectionGroupWithJira } from "../../src/features/selection-groups/types.js";
import { comments as fixtureComments } from "../mocks/fixtures.js";

/**
 * SPEC-011 amendment (membership policy): the comments panel offers a
 * selection only the groups it may move into. A selection whose synthetic
 * group has a ticket is locked: it has no move action at all. This is the
 * case that let a locked selection move into another ticketed synthetic
 * group and lose its ticket's group.
 */

const groups: SelectionGroupWithJira[] = [
  { id: "checkout", name: "Checkout", createdAt: 1, revealed: false },
  {
    id: "released",
    name: "Released",
    createdAt: 5,
    revealed: false,
    jiraTicketId: "SCRUM-3",
  },
  {
    id: "synthetic-header",
    name: "Header",
    createdAt: 2,
    revealed: false,
    synthetic: true,
    jiraTicketId: "SCRUM-8",
  },
  {
    id: "synthetic-button",
    name: "Button",
    createdAt: 3,
    revealed: false,
    synthetic: true,
    jiraTicketId: "SCRUM-9",
  },
  {
    id: "synthetic-price",
    name: "Price",
    createdAt: 4,
    revealed: false,
    synthetic: true,
  },
];

const [base] = fixtureComments;
const selection = (
  id: string,
  groupId: string,
  componentName: string,
  commentText: string,
): CommentItem => ({
  ...base,
  id,
  groupId,
  componentName,
  commentText,
  jiraTicketId: undefined,
  status: "open",
});

const selections: CommentItem[] = [
  selection("header-item", "synthetic-header", "HeaderBar", "Header locked"),
  selection("button-item", "synthetic-button", "BuyButton", "Button locked"),
  selection("price-item", "synthetic-price", "PriceTag", "Price is open"),
  selection("released-item", "released", "Footer", "Footer shipped"),
];

const row = (page: Page, text: string) =>
  page
    .locator(
      "[data-react-grab-comments-dropdown] [data-react-grab-comment-item]",
    )
    .filter({ hasText: text });

test.describe("Comments panel — move policy", { tag: ["@SPEC-011"] }, () => {
  test.beforeEach(async ({ reactGrab }) => {
    await reactGrab.populate({ groups, comments: selections });
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);
    await reactGrab.clickCommentsButton();
  });

  test(
    "the move picker lists only groups the selection may move into",
    {
      annotation: {
        type: "ac",
        description: "SPEC-011 amendment AC-1: targets are open real groups",
      },
    },
    async ({ page, reactGrab }) => {
      const price = row(page, "Price is open");
      await price.hover();
      await price.getByRole("button", { name: "Selection actions" }).click();
      await page.getByRole("menuitem", { name: "Move to group" }).click();

      const destinations = page.locator("[data-react-grab-move-destination]");
      await expect(destinations).toHaveText(["Ungrouped", "Checkout"]);
      await reactGrab.screenshot("move-picker", "page");
    },
  );

  test(
    "picking a group in the menu moves the selection without selecting it",
    {
      annotation: {
        type: "ac",
        description: "SPEC-011 amendment AC-1: the move goes where it was told",
      },
    },
    async ({ page }) => {
      const price = row(page, "Price is open");
      await price.hover();
      await price.getByRole("button", { name: "Selection actions" }).click();
      await page.getByRole("menuitem", { name: "Move to group" }).click();
      await page
        .locator("[data-react-grab-move-destination]")
        .filter({ hasText: "Checkout" })
        .click();

      const checkout = page
        .locator("[data-react-grab-group-collapsible]")
        .filter({ hasText: "Checkout" });
      await expect(checkout).toContainText("Price is open");
      // Selecting a row shows or hides its selection on the page; the
      // fixture starts it shown, and the move left it so.
      await expect(row(page, "Price is open")).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      // Control: selecting the row does toggle it, so the check above means
      // something.
      await row(page, "Price is open").click();
      await expect(row(page, "Price is open")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    },
  );

  test(
    "a locked selection has no move action",
    {
      annotation: {
        type: "ac",
        description:
          "SPEC-011 amendment AC-2: a locked selection never leaves its group",
      },
    },
    async ({ page, reactGrab }) => {
      const header = row(page, "Header locked");
      await header.hover();
      await reactGrab.screenshot("locked-row-hovered", "page");
      await header.getByRole("button", { name: "Selection actions" }).click();
      await expect(
        page.getByRole("menuitem", { name: "Open in sidebar" }),
      ).toBeVisible();
      await expect(
        page.getByRole("menuitem", { name: "Move to group" }),
      ).toHaveCount(0);
    },
  );

  test(
    "a ticketed group offers no delete",
    {
      annotation: {
        type: "ac",
        description:
          "SPEC-011 amendment AC-3: a ticketed group cannot be deleted from under its selections",
      },
    },
    async ({ page }) => {
      const panel = page.locator("[data-react-grab-comments-dropdown]");
      const groupCard = (name: string) =>
        panel.locator("[data-react-grab-group-collapsible]").filter({
          hasText: name,
        });
      await expect(
        groupCard("Released").getByRole("button", { name: "Delete group" }),
      ).toHaveCount(0);
      await expect(
        groupCard("Checkout").getByRole("button", { name: "Delete group" }),
      ).toHaveCount(1);
    },
  );
});
