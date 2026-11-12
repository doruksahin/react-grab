import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures.js";
import * as fixtures from "../mocks/fixtures.js";

/**
 * Historical SPEC-013 exploratory test notes (retained for context).
 * The executable tests below verify the current HEAD editor UI with hard assertions.
 *
 * Uses mockServer fixture for HTTP interception + manual initSync.
 * Screenshots are attached to the Playwright HTML report at every meaningful step.
 *
 * Each test is annotated with its AC item for traceability in the HTML report.
 * Tests are resilient — if a UI element is not reachable, the test still
 * captures screenshots at whatever state it reaches, so the report remains useful.
 *
 * TODO(SPEC-013): When comment UI is wired into the detail view:
 * 1. Convert early returns to hard expect() assertions
 * 2. Replace waitForTimeout() calls with expect.poll() for stability
 */

const selectionLabel = (page: Page) =>
  page
    .locator("[data-react-grab-selection-label]")
    .filter({ hasText: "Navigation bar is misaligned on mobile viewports" });
const composer = (page: Page) =>
  selectionLabel(page).locator("[data-react-grab-comment-composer]").first();
const editor = (page: Page) =>
  composer(page).locator('[contenteditable="true"]');

test.describe("Jira editor current UI contract", () => {
  test.beforeEach(async ({ reactGrab, mockServer }) => {
    mockServer.override("listComments", [fixtures.comments[0]]);
    await reactGrab.triggerInitSync();
    await expect(
      selectionLabel(reactGrab.page).locator(
        '[data-react-grab-jira-comment-id="jira-cmt-1"]',
      ),
    ).toBeVisible();
    await expect(editor(reactGrab.page)).toBeVisible();
  });

  test("Save posts markdown to the group's route and refreshes the displayed comment", async ({
    page,
    mockServer,
  }) => {
    const text = "Verified through the real editor";
    mockServer.override("addJiraComment", () => {
      mockServer.override("getJiraTicketStatus", {
        ...fixtures.jiraTicketStatusATT101,
        comments: [
          ...fixtures.jiraTicketStatusATT101.comments,
          {
            id: "jira-cmt-new-1",
            parentId: null,
            author: "You",
            authorAvatar: null,
            body: text,
            createdAt: fixtures.addJiraCommentResponse.created,
          },
        ],
      });
      return fixtures.addJiraCommentResponse;
    });
    await editor(page).fill(text);
    await composer(page)
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect
      .poll(() => mockServer.requests("addJiraComment").length)
      .toBe(1);
    expect(mockServer.requests("addJiraComment")[0]).toMatchObject({
      method: "POST",
      url: expect.stringContaining("/groups/grp-1/jira-comment"),
      body: { body: text, mentions: [] },
    });
    await expect(editor(page)).toHaveText("");
    await expect(
      selectionLabel(page).locator(
        '[data-react-grab-jira-comment-id="jira-cmt-new-1"]',
      ),
    ).toContainText(text);
    await expect(
      selectionLabel(page).locator(
        '[data-react-grab-jira-comment-state="sending"]',
      ),
    ).toHaveCount(0);
  });

  test("empty Save does not send a comment", async ({ page, mockServer }) => {
    await composer(page)
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect(editor(page)).toHaveText("");
    expect(mockServer.requests("addJiraComment")).toHaveLength(0);
  });

  test("Reply opens an independent editor and Cancel removes the draft", async ({
    page,
    mockServer,
  }) => {
    await editor(page).fill("Keep main draft");
    await selectionLabel(page).getByTitle("Reply", { exact: true }).click();
    const reply = selectionLabel(page).locator(
      "[data-react-grab-inline-reply]",
    );
    await expect(reply).toContainText("Replying to Alice Cooper");
    await reply.locator('[contenteditable="true"]').fill("Discard reply draft");
    await reply.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(reply).toHaveCount(0);
    await expect(editor(page)).toHaveText("Keep main draft");
    expect(mockServer.requests("addJiraComment")).toHaveLength(0);
  });

  test("reply Save includes the parent comment id", async ({
    page,
    mockServer,
  }) => {
    await selectionLabel(page).getByTitle("Reply", { exact: true }).click();
    const reply = selectionLabel(page).locator(
      "[data-react-grab-inline-reply]",
    );
    await reply.locator('[contenteditable="true"]').fill("Verified reply");
    await reply.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(() => mockServer.requests("addJiraComment").length)
      .toBe(1);
    expect(mockServer.requests("addJiraComment")[0].body).toMatchObject({
      body: "Verified reply",
      parentId: "jira-cmt-1",
      mentions: [],
    });
    await expect(reply).toHaveCount(0);
  });

  test("formatting toggle exposes working bold, quote and code block commands", async ({
    page,
    mockServer,
  }) => {
    await composer(page)
      .getByTitle("Toggle formatting", { exact: true })
      .click();
    await composer(page).getByTitle("Bold", { exact: true }).click();
    await editor(page).pressSequentially("Formatted text");
    await expect(editor(page).locator("strong")).toHaveText("Formatted text");
    await composer(page).getByTitle("Blockquote", { exact: true }).click();
    await expect(editor(page).locator("blockquote")).toContainText(
      "Formatted text",
    );
    await composer(page).getByTitle("Blockquote", { exact: true }).click();
    await composer(page).getByTitle("Code block", { exact: true }).click();
    await expect(editor(page).locator("pre code")).toHaveText("Formatted text");
    await composer(page)
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect
      .poll(() => mockServer.requests("addJiraComment").length)
      .toBe(1);
    expect(mockServer.requests("addJiraComment")[0].body).toMatchObject({
      body: expect.stringContaining("```\nFormatted text\n```"),
    });
  });

  test("mention picker sends the selected account mapping", async ({
    page,
    mockServer,
  }) => {
    await expect(
      composer(page).locator("[data-react-grab-comment-hint]"),
    ).toContainText("to mention");
    await editor(page).pressSequentially("@Ali");
    const option = page
      .locator("[data-react-grab-mention-option]")
      .filter({ hasText: "Alice Cooper" });
    await option.click();
    await expect(editor(page).locator(".mention")).toContainText(
      "Alice Cooper",
    );
    await composer(page)
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect
      .poll(() => mockServer.requests("addJiraComment").length)
      .toBe(1);
    expect(mockServer.requests("searchJiraUsers").length).toBeGreaterThan(0);
    expect(mockServer.requests("addJiraComment")[0].body).toMatchObject({
      body: expect.stringContaining("@Alice Cooper"),
      mentions: [
        {
          text: "@Alice Cooper",
          accountId: fixtures.searchJiraUsers[0].accountId,
        },
      ],
    });
  });

  test("image file is serialized into the comment request", async ({
    page,
    mockServer,
  }) => {
    await editor(page).fill("Comment with image");
    await composer(page)
      .locator("[data-react-grab-editor-image-input]")
      .setInputFiles({
        name: "pixel.png",
        mimeType: "image/png",
        buffer: Buffer.from(fixtures.screenshotFull),
      });
    await expect(editor(page).locator("img")).toHaveAttribute(
      "src",
      /^data:image\/png;base64,/,
    );
    await composer(page)
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect
      .poll(() => mockServer.requests("addJiraComment").length)
      .toBe(1);
    expect(mockServer.requests("addJiraComment")[0].body).toMatchObject({
      body: expect.stringContaining("data:image/png;base64,"),
    });
  });

  test("failed POST shows an error and removes the sending placeholder", async ({
    page,
    mockServer,
  }) => {
    mockServer.override("addJiraComment", () => null);
    await editor(page).fill("This request will fail");
    await composer(page)
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect
      .poll(() => mockServer.requests("addJiraComment").length)
      .toBe(1);
    await expect(
      selectionLabel(page).locator("[data-react-grab-comments-error]"),
    ).toBeVisible();
    await expect(
      selectionLabel(page).locator(
        '[data-react-grab-jira-comment-state="sending"]',
      ),
    ).toHaveCount(0);
    await expect(
      selectionLabel(page).locator("[data-react-grab-comments-list]"),
    ).not.toContainText("This request will fail");
  });
});
