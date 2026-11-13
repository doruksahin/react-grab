import { test, expect, type ReactGrabPageObject } from "../fixtures.js";
import type { Page } from "@playwright/test";
import * as fixtures from "../mocks/fixtures.js";

/**
 * SPEC-020: with recording enabled, saving a comment uploads the recent
 * rrweb window, the comment keeps the returned link, and both the card and
 * the Jira description point to it.
 */

const NEW_COMMENT = "Checkout button does nothing";

const addComment = async (reactGrab: ReactGrabPageObject) => {
  await reactGrab.registerCommentAction();
  await reactGrab.enterPromptMode("li:first-child");
  await reactGrab.typeInInput(NEW_COMMENT);
  await reactGrab.submitInput();
};

interface CommentBody {
  commentText?: string;
  recordingUrl?: string;
}

const isCommentBody = (body: unknown): body is CommentBody =>
  typeof body === "object" && body !== null && !Array.isArray(body);

const savedRecordingUrls = (
  requests: ReadonlyArray<{ body: unknown }>,
): Array<string | undefined> =>
  requests
    .map((request) => request.body)
    .filter(isCommentBody)
    .filter((body) => body.commentText === NEW_COMMENT)
    .map((body) => body.recordingUrl);

const openSelectionCard = async (page: Page) => {
  await page.locator("[data-react-grab-toolbar-dashboard]").click();
  await page
    .getByRole("dialog", { name: "React Grab Dashboard" })
    .getByRole("button", { name: /^Selections/ })
    .click();
  return page
    .locator("[data-react-grab-selection-card]")
    .filter({ hasText: NEW_COMMENT });
};

const startWithRecording = async (
  reactGrab: ReactGrabPageObject,
  enabled: boolean,
) => {
  if (enabled) {
    await reactGrab.reinitialize({ recording: { enabled: true } });
  }
  await reactGrab.triggerInitSync();
  await expect
    .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
    .toBe(true);
};

test.describe("Session recording", { tag: ["@SPEC-020"] }, () => {
  test(
    "a new comment uploads its recording and keeps the link",
    { annotation: { type: "ac", description: "SPEC-020 AC-1, AC-2" } },
    async ({ page, reactGrab, mockServer }) => {
      await startWithRecording(reactGrab, true);
      await addComment(reactGrab);

      await expect
        .poll(() => mockServer.requests("uploadRecording").length, {
          timeout: 5000,
        })
        .toBe(1);
      const [upload] = mockServer.requests("uploadRecording");
      expect(upload.authorization).toBe(`Bearer ${fixtures.TEST_API_TOKEN}`);

      await expect
        .poll(() => savedRecordingUrls(mockServer.requests("upsertComment")), {
          timeout: 5000,
        })
        .toContain(fixtures.RECORDING_URL);

      const card = await openSelectionCard(page);
      await expect(
        card.locator("[data-react-grab-recording-link]"),
      ).toHaveAttribute("href", fixtures.RECORDING_URL);
    },
  );

  test(
    "the Jira description links the recording",
    { annotation: { type: "ac", description: "SPEC-020 AC-3" } },
    async ({ page, reactGrab, mockServer }) => {
      await startWithRecording(reactGrab, true);
      await addComment(reactGrab);
      await expect
        .poll(() => savedRecordingUrls(mockServer.requests("upsertComment")), {
          timeout: 5000,
        })
        .toContain(fixtures.RECORDING_URL);

      const card = await openSelectionCard(page);
      await card.locator("[data-react-grab-create-ticket]").click();
      const form = page.locator("[data-react-grab-jira-form]");
      await form.getByRole("button", { name: "Create Ticket" }).click();
      await expect(form.locator("[data-react-grab-jira-success]")).toBeVisible({
        timeout: 5000,
      });

      const [ticket] = mockServer.requests("createJiraTicket");
      expect(JSON.stringify(ticket.body)).toContain(
        `[Watch how we got here](${fixtures.RECORDING_URL})`,
      );
    },
  );

  test(
    "without the option, nothing is recorded or uploaded",
    { annotation: { type: "ac", description: "SPEC-020 AC-5" } },
    async ({ reactGrab, mockServer }) => {
      await startWithRecording(reactGrab, false);
      await addComment(reactGrab);
      await expect
        .poll(() => savedRecordingUrls(mockServer.requests("upsertComment")), {
          timeout: 5000,
        })
        .toHaveLength(1);

      expect(mockServer.requests("uploadRecording")).toEqual([]);
      expect(savedRecordingUrls(mockServer.requests("upsertComment"))).toEqual([
        undefined,
      ]);
    },
  );

  test("a failed recording upload still saves the comment", async ({
    reactGrab,
    mockServer,
  }) => {
    mockServer.override("uploadRecording", () => null);
    await startWithRecording(reactGrab, true);
    await addComment(reactGrab);

    await expect
      .poll(() => mockServer.requests("uploadRecording").length, {
        timeout: 5000,
      })
      .toBe(1);
    expect(savedRecordingUrls(mockServer.requests("upsertComment"))).toEqual([
      undefined,
    ]);
  });
});
