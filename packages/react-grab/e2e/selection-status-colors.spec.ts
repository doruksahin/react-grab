import { test, expect } from "./fixtures.js";
import type { ReactGrabPageObject } from "./fixtures.js";

const ATTR = "data-react-grab";

const GROUPS_KEY = "react-grab-selection-groups";
const COMMENT_ITEMS_KEY = "react-grab-comment-items";

/** Set up pre-fabricated localStorage state with a comment item in a group with given JIRA state. */
const seedJiraState = async (
  reactGrab: ReactGrabPageObject,
  opts: { jiraTicketId?: string; jiraResolved?: boolean },
) => {
  const { page } = reactGrab;
  const DEFAULT_GROUP_ID = "default";

  await page.evaluate(
    ({ groupsKey, itemsKey, groupId, jiraTicketId, jiraResolved }) => {
      const group = {
        id: groupId,
        name: "Default",
        createdAt: 0,
        revealed: true,
        jiraTicketId,
      };
      localStorage.setItem(groupsKey, JSON.stringify([group]));

      const item = {
        id: "test-item-1",
        groupId,
        tagName: "li",
        elementName: "li",
        content: "test content",
        revealed: true,
        createdAt: Date.now(),
      };
      localStorage.setItem(itemsKey, JSON.stringify([item]));

      // Mark jiraResolved in the group — this lives only in sidebar's local signal,
      // but we can simulate it via a storage event.
      if (jiraResolved) {
        (window as unknown as Record<string, unknown>).__REACT_GRAB_JIRA_RESOLVED_TEST__ =
          true;
      }
    },
    {
      groupsKey: GROUPS_KEY,
      itemsKey: COMMENT_ITEMS_KEY,
      groupId: DEFAULT_GROUP_ID,
      jiraTicketId: opts.jiraTicketId,
      jiraResolved: opts.jiraResolved ?? false,
    },
  );
};

/** Read the status badge from the shadow DOM label instances. Returns the badge value or null. */
const getStatusBadge = async (
  page: import("@playwright/test").Page,
): Promise<string | null> => {
  return page.evaluate((attrName) => {
    const host = document.querySelector(`[${attrName}]`);
    const shadowRoot = host?.shadowRoot;
    if (!shadowRoot) return null;
    const root = shadowRoot.querySelector(`[${attrName}]`);
    if (!root) return null;
    const badge = root.querySelector<HTMLElement>(
      "[data-react-grab-status-badge]",
    );
    return badge?.getAttribute("data-react-grab-status-badge") ?? null;
  }, ATTR);
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
    test("hover preview label shows no status badge for open groups", async ({
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

      const badge = await getStatusBadge(reactGrab.page);
      expect(badge).toBeNull();
    });
  });

  test.describe("Ticketed group (has JIRA ticket ID)", () => {
    test.beforeEach(async ({ reactGrab }) => {
      await seedJiraState(reactGrab, { jiraTicketId: "PROJ-123" });
      await reactGrab.reinitialize();
      await expect
        .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
        .toBe(true);
    });

    test("hover preview label shows yellow ticket badge for ticketed group", async ({
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

      const badge = await getStatusBadge(page);
      expect(badge).toBe("ticketed");
    });

    test("ticketed badge tooltip shows ticket ID", async ({ reactGrab }) => {
      const { page } = reactGrab;

      await reactGrab.clickCommentsButton();
      await expect
        .poll(() => reactGrab.isCommentsDropdownVisible(), { timeout: 2000 })
        .toBe(true);

      await reactGrab.hoverCommentItem(0);
      await page.waitForTimeout(300);

      const title = await page.evaluate((attrName) => {
        const host = document.querySelector(`[${attrName}]`);
        const shadowRoot = host?.shadowRoot;
        if (!shadowRoot) return null;
        const root = shadowRoot.querySelector(`[${attrName}]`);
        if (!root) return null;
        const badge = root.querySelector<HTMLElement>(
          "[data-react-grab-status-badge]",
        );
        return badge?.getAttribute("title") ?? null;
      }, ATTR);

      expect(title).toContain("PROJ-123");
      expect(title).toContain("Ticketed");
    });
  });
});
