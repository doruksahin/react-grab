import { test, expect } from "./fixtures.js";
import type { ReactGrabPageObject } from "./fixtures.js";

const seedJiraState = async (reactGrab: ReactGrabPageObject) => {
  await reactGrab.populate({
    groups: [
      {
        id: "ticketed-group",
        name: "Ticketed",
        createdAt: Date.now(),
        jiraTicketId: "PROJ-123",
        jiraStatus: "In Progress",
        jiraStatusCategory: "indeterminate",
        jiraUrl: "https://example.test/browse/PROJ-123",
      },
    ],
    comments: [
      {
        id: "test-item-1",
        groupId: "ticketed-group",
        tagName: "h1",
        elementName: "h1",
        content: "test content",
        revealed: false,
        timestamp: Date.now(),
        elementSelectors: ['[data-testid="main-title"]'],
        previewBounds: [],
      },
    ],
  });
};

/** Copy element and wait for comment item to appear. */
const copyElement = async (
  reactGrab: ReactGrabPageObject,
  selector: string,
) => {
  await reactGrab.registerCommentAction();
  await reactGrab.enterPromptMode(selector);
  await reactGrab.typeInInput("test comment");
  await reactGrab.submitInput();
  await expect
    .poll(() => reactGrab.getClipboardContent(), { timeout: 5000 })
    .toBeTruthy();
  await reactGrab.page.waitForTimeout(300);
};

test.describe("Selection Status Colors", () => {
  test.describe("Open group (no JIRA ticket)", () => {
    test("hover preview label shows no ticket link for open groups", async ({
      reactGrab,
    }) => {
      await expect
        .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
        .toBe(true);

      await copyElement(reactGrab, "li:first-child");

      // Open comments dropdown and hover the item to show hover preview
      await reactGrab.clickCommentsButton();
      await expect
        .poll(() => reactGrab.isCommentsDropdownVisible(), { timeout: 2000 })
        .toBe(true);

      await reactGrab.hoverCommentItem(0);
      await reactGrab.page.waitForTimeout(200);

      const label = reactGrab.page
        .locator("[data-react-grab-selection-label]")
        .filter({ hasText: "test comment" });
      await expect(label).toBeVisible();
      await expect(label.getByRole("link")).toHaveCount(0);
    });
  });

  test.describe("Ticketed group (has JIRA ticket ID)", () => {
    test.beforeEach(async ({ reactGrab }) => {
      await seedJiraState(reactGrab);
      await expect
        .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
        .toBe(true);
    });

    test("hover preview label shows the Jira status for ticketed group", async ({
      reactGrab,
    }) => {
      const { page } = reactGrab;

      // Click the comments button to open the dropdown
      await reactGrab.clickCommentsButton();
      await expect
        .poll(() => reactGrab.isCommentsDropdownVisible(), { timeout: 2000 })
        .toBe(true);

      await reactGrab.hoverCommentItem(0);
      await page.waitForTimeout(300);

      const status = page
        .locator("[data-react-grab-selection-label]")
        .getByText("In Progress", { exact: true });
      await expect(status).toBeVisible();
      await expect(status).toHaveClass(/text-blue-400/);
    });

    test("ticketed preview links to the Jira ticket", async ({ reactGrab }) => {
      const { page } = reactGrab;

      await reactGrab.clickCommentsButton();
      await expect
        .poll(() => reactGrab.isCommentsDropdownVisible(), { timeout: 2000 })
        .toBe(true);

      await reactGrab.hoverCommentItem(0);
      await page.waitForTimeout(300);

      const ticket = page
        .locator("[data-react-grab-selection-label]")
        .getByRole("link", { name: "PROJ-123", exact: true });
      await expect(ticket).toBeVisible();
      await expect(ticket).toHaveAttribute(
        "href",
        "https://example.test/browse/PROJ-123",
      );
    });
  });
});
