import { test, expect, type ReactGrabPageObject } from "../fixtures.js";
import type { Page } from "@playwright/test";
import * as fixtures from "../mocks/fixtures.js";

/**
 * ADR-0019: the client writes comments and groups one item at a time and
 * never sends a whole list, so a stale tab cannot erase what others wrote.
 *
 * The workspace starts with the mock server's existing comments and groups,
 * which this tab did not create. The tests check that the tab's own changes
 * reach the server as single-item requests and that it never touches the
 * items it did not change.
 */

const NEW_COMMENT = "Price label overlaps the badge";

const addComment = async (reactGrab: ReactGrabPageObject) => {
  await reactGrab.registerCommentAction();
  await reactGrab.enterPromptMode("li:first-child");
  await reactGrab.typeInInput(NEW_COMMENT);
  await reactGrab.submitInput();
};

interface WriteBody {
  id?: string;
  commentText?: string;
  jiraTicketId?: string;
  status?: string;
}

const isObjectBody = (body: unknown): body is WriteBody =>
  typeof body === "object" && body !== null && !Array.isArray(body);

const openTicketDialog = async (page: Page) => {
  await page.locator("[data-react-grab-toolbar-dashboard]").click();
  await page
    .getByRole("dialog", { name: "React Grab Dashboard" })
    .getByRole("button", { name: /^Selections/ })
    .click();
  await page
    .locator("[data-react-grab-selection-card]")
    .filter({ hasText: NEW_COMMENT })
    .locator("[data-react-grab-create-ticket]")
    .click();
};

test.describe("Authenticated screenshots", { tag: ["@ADR-0020"] }, () => {
  test("a screenshot is fetched with the token and shown from a blob URL", async ({
    page,
    reactGrab,
    mockServer,
  }) => {
    // Regression guard: persisting from inside an effect once looped forever
    // ("Maximum call stack size exceeded") without failing any test.
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const [first] = fixtures.comments;
    mockServer.override("listComments", [
      {
        ...first,
        screenshotElement: `screenshots/${first.id}/element.png`,
        screenshotFullPage: `screenshots/${first.id}/full.png`,
      },
    ]);
    await reactGrab.triggerInitSync();
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);

    const dashboard = page.getByRole("dialog", {
      name: "React Grab Dashboard",
    });
    await page.locator("[data-react-grab-toolbar-dashboard]").click();
    await dashboard.getByRole("button", { name: /^Selections/ }).click();

    const thumb = page.locator("[data-react-grab-screenshot-thumb]").first();
    await expect(thumb).toHaveAttribute("src", /^blob:/, { timeout: 5000 });

    const fetched = mockServer.requests("getScreenshot");
    expect(fetched.length).toBeGreaterThan(0);
    for (const request of fetched) {
      expect(request.authorization).toBe(`Bearer ${fixtures.TEST_API_TOKEN}`);
    }
    expect(pageErrors).toEqual([]);
  });
});

test.describe("Per-item writes", { tag: ["@ADR-0019", "@SPEC-014"] }, () => {
  test.beforeEach(async ({ reactGrab, mockServer: _mockServer }) => {
    await reactGrab.triggerInitSync();
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);
  });

  test("a new comment is one request, and the existing ones are left alone", async ({
    reactGrab,
    mockServer,
  }) => {
    await addComment(reactGrab);

    await expect
      .poll(
        () =>
          mockServer
            .requests("upsertComment")
            .map((request) => request.body)
            .filter(isObjectBody)
            .filter((body) => body.commentText === NEW_COMMENT).length,
        { timeout: 5000 },
      )
      .toBe(1);

    const existingIds = new Set(fixtures.comments.map((item) => item.id));
    const touchedExisting = mockServer
      .requests("upsertComment")
      .map((request) => request.body)
      .filter(isObjectBody)
      .filter((body) => body.id !== undefined && existingIds.has(body.id));
    expect(touchedExisting).toEqual([]);
    expect(mockServer.requests("deleteComment")).toEqual([]);
  });

  test("no write carries a list", async ({ reactGrab, mockServer }) => {
    await addComment(reactGrab);
    await expect
      .poll(() => mockServer.requests("upsertComment").length, {
        timeout: 5000,
      })
      .toBeGreaterThan(0);

    const everyWrite = [
      ...mockServer.requests("upsertComment"),
      ...mockServer.requests("upsertGroup"),
    ];
    expect(everyWrite.some((request) => Array.isArray(request.body))).toBe(
      false,
    );
  });

  test("clearing deletes each comment this tab knows, one request per comment", async ({
    reactGrab,
    mockServer,
  }) => {
    await addComment(reactGrab);
    await reactGrab.clickCommentsButton();
    await reactGrab.clickCommentsClear();

    const expectedIds = [...fixtures.comments.map((item) => item.id)];
    await expect
      .poll(() => mockServer.requests("deleteComment").length, {
        timeout: 5000,
      })
      .toBeGreaterThanOrEqual(expectedIds.length);

    const deletedUrls = mockServer
      .requests("deleteComment")
      .map((request) => request.url);
    for (const id of expectedIds) {
      expect(deletedUrls.some((url) => url.endsWith(`/comments/${id}`))).toBe(
        true,
      );
    }
  });

  test("every request to the sync server carries the API token", async ({
    page,
    reactGrab,
    mockServer,
  }) => {
    await addComment(reactGrab);
    await openTicketDialog(page);
    const form = page.locator("[data-react-grab-jira-form]");
    await form.getByRole("button", { name: "Create Ticket" }).click();
    await expect(form.locator("[data-react-grab-jira-success]")).toBeVisible({
      timeout: 5000,
    });

    const endpoints = [
      "listComments",
      "listGroups",
      "upsertComment",
      "upsertGroup",
      "listJiraIssueTypes",
      "listJiraPriorities",
      "createJiraTicket",
    ] as const;
    for (const endpoint of endpoints) {
      const requests = mockServer.requests(endpoint);
      expect(requests.length, `${endpoint} was called`).toBeGreaterThan(0);
      for (const request of requests) {
        expect(request.authorization, `${endpoint} sent the token`).toBe(
          `Bearer ${fixtures.TEST_API_TOKEN}`,
        );
      }
    }
  });

  test("group writes never carry the ticket fields the server owns", async ({
    page,
    reactGrab,
    mockServer,
  }) => {
    await addComment(reactGrab);
    await openTicketDialog(page);

    const form = page.locator("[data-react-grab-jira-form]");
    await form.getByRole("button", { name: "Create Ticket" }).click();
    await expect(form.locator("[data-react-grab-jira-success]")).toBeVisible({
      timeout: 5000,
    });

    const groupBodies = mockServer
      .requests("upsertGroup")
      .map((request) => request.body)
      .filter(isObjectBody);
    expect(groupBodies.length).toBeGreaterThan(0);
    for (const body of groupBodies) {
      expect(body).not.toHaveProperty("jiraTicketId");
      expect(body).not.toHaveProperty("status");
    }
  });
});
