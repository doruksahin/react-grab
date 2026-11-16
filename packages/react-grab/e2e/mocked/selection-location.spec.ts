import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures.js";
import type { CommentItem } from "../../src/types.js";
import type { SelectionGroupWithJira } from "../../src/features/selection-groups/types.js";
import { comments as fixtureComments } from "../mocks/fixtures.js";
import { openGroupDetail } from "../open-group-detail.js";

/**
 * ADR-0024: a selection whose element is not on the page says where it was
 * made, and a same-site page is one click away.
 */

const ORIGIN = "http://localhost:5175";

const groups: SelectionGroupWithJira[] = [
  { id: "checkout", name: "Checkout", createdAt: 1, revealed: false },
];

const [base] = fixtureComments;
const selection = (
  id: string,
  commentText: string,
  pageUrl: string,
  elementSelectors: string[],
): CommentItem => ({
  ...base,
  id,
  groupId: "checkout",
  commentText,
  pageUrl,
  elementSelectors,
  jiraTicketId: undefined,
  status: "open",
});

const MISSING = ["section.not-in-the-e2e-app"];

const selections: CommentItem[] = [
  selection("here", "Todo list here", `${ORIGIN}/`, [
    '[data-testid="todo-list"]',
  ]),
  selection(
    "billing",
    "Made on billing",
    `${ORIGIN}/settings/billing?plan=pro`,
    MISSING,
  ),
  selection(
    "local",
    "Made locally",
    "http://localhost:3000/dashboard",
    MISSING,
  ),
  selection("gone", "Element removed", `${ORIGIN}/?tab=2`, MISSING),
  selection("blob", "Stored oddly", `blob:${ORIGIN}/1234`, MISSING),
];

const row = (page: Page, text: string) =>
  page
    .locator(
      "[data-react-grab-comments-dropdown] [data-react-grab-comment-item]",
    )
    .filter({ hasText: text });

const note = (page: Page, text: string) =>
  row(page, text).locator("[data-react-grab-selection-location]");

const KIND = "data-react-grab-selection-location-kind";

// The way back (Open page, Guide me) lives in the sidebar card's notice; a
// comments row only says where the selection is.
const openCard = async (page: Page, text: string) => {
  await page.locator("[data-react-grab-toolbar-dashboard]").click();
  await openGroupDetail(page, "Checkout");
  return page
    .locator("[data-react-grab-selection-card]")
    .filter({ hasText: text });
};

test.describe("Selection location", { tag: ["@ADR-0024"] }, () => {
  test.beforeEach(async ({ reactGrab }) => {
    await reactGrab.populate({ groups, comments: selections });
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);
    await reactGrab.clickCommentsButton();
  });

  test("each row not on the page says where", async ({ page, reactGrab }) => {
    await expect(note(page, "Made on billing")).toHaveText("/settings/billing");
    await expect(note(page, "Made on billing")).toHaveAttribute(
      "title",
      "Made on /settings/billing",
    );
    await expect(note(page, "Made locally")).toHaveText("localhost:3000");
    await expect(note(page, "Element removed")).toHaveText(
      "No longer on this page",
    );
    await expect(note(page, "Todo list here")).toHaveCount(0);
    await reactGrab.screenshot("location-reasons", "page");
  });

  test("only a same-site page offers Open page", async ({ page }) => {
    await expect(
      page.locator("[data-react-grab-selection-location-open]"),
    ).toHaveCount(0);
    const localCard = await openCard(page, "Made locally");
    await expect(
      page.locator("[data-react-grab-selection-location-open]"),
    ).toHaveCount(1);
    await expect(
      localCard.locator("[data-react-grab-selection-location-open]"),
    ).toHaveCount(0);
  });

  test("a URL that is not an http(s) page reads as unknown", async ({
    page,
  }) => {
    await expect(note(page, "Stored oddly")).toHaveAttribute(KIND, "unknown");
    await expect(
      row(page, "Stored oddly").locator(
        "[data-react-grab-selection-location-open]",
      ),
    ).toHaveCount(0);
  });

  test("the reason follows a same-document navigation", async ({ page }) => {
    await expect(note(page, "Made on billing")).toHaveAttribute(
      KIND,
      "other-page",
    );
    await page.evaluate(() => history.pushState({}, "", "/settings/billing"));
    await expect(note(page, "Made on billing")).toHaveAttribute(KIND, "gone");
    await expect(note(page, "Element removed")).toHaveAttribute(
      KIND,
      "other-page",
    );
  });

  test("Open page navigates without selecting the card", async ({ page }) => {
    // Selecting a row whose element is missing copies it. A 204 response
    // cancels the navigation, so the page stays to be checked.
    const billingUrl = `${ORIGIN}/settings/billing?plan=pro`;
    await page.route(billingUrl, (route) => route.fulfill({ status: 204 }));
    await page.evaluate(() => {
      document.documentElement.dataset.copyCount = "0";
      document.addEventListener(
        "copy",
        () => {
          const root = document.documentElement;
          root.dataset.copyCount = String(Number(root.dataset.copyCount) + 1);
        },
        true,
      );
    });
    // Control: selecting a row does copy, so the count below means something.
    const copyCount = page.locator("html");
    await row(page, "Made locally").click();
    await expect(copyCount).toHaveAttribute("data-copy-count", "1");

    const requested = page.waitForRequest(billingUrl);
    const card = await openCard(page, "Made on billing");
    await card.locator("[data-react-grab-selection-location-open]").click();
    await requested;
    await expect(copyCount).toHaveAttribute("data-copy-count", "1");
  });

  test("Open page goes to the page the selection was made on", async ({
    page,
  }) => {
    const card = await openCard(page, "Made on billing");
    await card.locator("[data-react-grab-selection-location-open]").click();
    await page.waitForURL(`${ORIGIN}/settings/billing?plan=pro`);
  });

  test("the sidebar card says where it was made", async ({ page }) => {
    const card = await openCard(page, "Made on billing");
    await expect(
      card.locator("[data-react-grab-selection-location]"),
    ).toHaveAttribute(KIND, "other-page");
    await expect(
      card.locator("[data-react-grab-selection-location]"),
    ).toContainText("On another page/settings/billing");
    await expect(
      card.getByRole("button", { name: "Open /settings/billing" }),
    ).toBeVisible();
  });
});
