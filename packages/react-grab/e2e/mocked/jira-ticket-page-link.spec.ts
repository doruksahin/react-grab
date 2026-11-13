import { test, expect } from "../fixtures.js";

/**
 * Scenario S5.6 + S8.1 (docs/scenarios/journey/scenarios.md, Plane RG-1):
 * a Jira ticket created from a comment links back to the page where the
 * comment was made, so the assignee can find it.
 *
 * Runs the real UI flow against the mocked sync server: capture an element,
 * comment on it, create a ticket from its sidebar card, and inspect the
 * HTTP payloads the overlay sends.
 */

const COMMENT_TEXT = "Price label overlaps the badge";

interface PersistedComment {
  commentText?: string;
  pageUrl?: string;
  pageTitle?: string;
}

interface CreateTicketBody {
  description?: string;
}

const isPersistedCommentArray = (body: unknown): body is PersistedComment[] =>
  Array.isArray(body);

const isCreateTicketBody = (body: unknown): body is CreateTicketBody =>
  typeof body === "object" && body !== null;

test.describe(
  "Jira ticket links back to the page",
  { tag: ["@SPEC-003", "@S5.6", "@S8.1"] },
  () => {
    test.beforeEach(async ({ reactGrab, mockServer: _mockServer }) => {
      await reactGrab.triggerInitSync();
      await expect
        .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
        .toBe(true);

      await reactGrab.registerCommentAction();
      await reactGrab.enterPromptMode("li:first-child");
      await reactGrab.typeInInput(COMMENT_TEXT);
      await reactGrab.submitInput();
    });

    test(
      "AC-1: a new comment stores the page URL and title",
      { annotation: { type: "ac", description: "S5.6 AC-1" } },
      async ({ page, mockServer }) => {
        const expectedUrl = page.url();
        const expectedTitle = await page.title();

        const findSavedComment = () =>
          mockServer
            .requests("persistComments")
            .map((request) => request.body)
            .filter(isPersistedCommentArray)
            .flat()
            .find((comment) => comment.commentText === COMMENT_TEXT);

        await expect
          .poll(() => findSavedComment(), { timeout: 5000 })
          .toBeDefined();
        expect(findSavedComment()).toMatchObject({
          pageUrl: expectedUrl,
          pageTitle: expectedTitle,
        });
      },
    );

    test(
      "AC-2: the ticket description links to the page",
      { annotation: { type: "ac", description: "S5.6 AC-2" } },
      async ({ page, mockServer, reactGrab }) => {
        const expectedUrl = page.url();
        const expectedTitle = await page.title();

        await page.locator("[data-react-grab-toolbar-dashboard]").click();
        await page
          .getByRole("dialog", { name: "React Grab Dashboard" })
          .getByRole("button", { name: /^Selections/ })
          .click();
        const card = page
          .locator("[data-react-grab-selection-card]")
          .filter({ hasText: COMMENT_TEXT });
        await card.locator("[data-react-grab-create-ticket]").click();

        const form = page.locator("[data-react-grab-jira-form]");
        const submit = form.getByRole("button", { name: "Create Ticket" });
        await expect(submit).toBeEnabled({ timeout: 5000 });
        await reactGrab.screenshot("jira-form-before-submit", "page");
        await submit.click();

        const findDescription = () =>
          mockServer
            .requests("createJiraTicket")
            .map((request) => request.body)
            .filter(isCreateTicketBody)
            .map((body) => body.description)
            .find((description) => description?.includes(COMMENT_TEXT));

        await expect
          .poll(() => findDescription(), { timeout: 5000 })
          .toBeDefined();
        expect(findDescription()).toContain(
          `- **Page:** [${expectedTitle}](${expectedUrl})`,
        );
      },
    );
  },
);
