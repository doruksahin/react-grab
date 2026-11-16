import { test, expect } from "../fixtures.js";

/**
 * Scenario S5.6 + S8.1 (docs/scenarios/journey/scenarios.md, Plane RG-1):
 * a Jira ticket created from a comment links back to the page where the
 * comment was made, so the assignee can find it.
 *
 * Runs the real UI flow against the mocked sync server: capture an element,
 * comment on it, and inspect the HTTP payloads the overlay sends. The sync
 * server builds the ticket description from the saved page address
 * (SPEC-021), so AC-2 is tested there: jira-ticket-description.test.ts.
 */

const COMMENT_TEXT = "Price label overlaps the badge";

interface PersistedComment {
  commentText?: string;
  pageUrl?: string;
  pageTitle?: string;
}

const isPersistedComment = (body: unknown): body is PersistedComment =>
  typeof body === "object" && body !== null && !Array.isArray(body);

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
            .requests("upsertComment")
            .map((request) => request.body)
            .filter(isPersistedComment)
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
  },
);
