import { test, expect } from "../fixtures.js";
import * as fixtures from "../mocks/fixtures.js";

/**
 * Proof-of-concept E2E tests for JIRA comment write-back.
 *
 * Uses mockServer fixture for HTTP interception + manual initSync.
 * mockServer routes are registered before page navigation, then
 * initSync is triggered manually in beforeEach.
 */

test.use({ video: "on" });

test.describe("JIRA comment write-back (PoC)", { tag: ["@SPEC-013"] }, () => {
  test.beforeEach(async ({ reactGrab }) => {
    // Trigger initSync manually — mockServer routes intercept the HTTP calls
    await reactGrab.page.evaluate(() => {
      return (window as any).__reactGrabSync.initSync({
        enabled: true,
        serverUrl: "http://localhost:9999",
        workspace: "test-workspace",
        jiraProjectKey: "ATT",
        syncRevealedState: true,
        onSyncError: (err: Error) => console.warn("[e2e] sync error:", err.message),
      });
    });

    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);
  });

  test("mock infrastructure intercepts sync-server calls", async ({
    mockServer,
    reactGrab,
  }) => {
    // initSync was triggered in beforeEach. By this point the overlay should
    // have fetched comments and groups from the mock server.

    const commentRequests = mockServer.requests("listComments");
    expect(commentRequests.length).toBeGreaterThanOrEqual(1);

    const groupRequests = mockServer.requests("listGroups");
    expect(groupRequests.length).toBeGreaterThanOrEqual(1);

    // Verify the URLs targeted the correct workspace
    expect(commentRequests[0].url).toContain(
      "/workspaces/test-workspace/comments",
    );
    expect(groupRequests[0].url).toContain(
      "/workspaces/test-workspace/groups",
    );

    await reactGrab.screenshot("page-loaded", "page");
  });

  test("getJiraTicketStatus route returns group-specific data", async ({
    page,
    mockServer,
  }) => {
    // getJiraTicketStatus is fetched on-demand (when user opens a selection
    // label), not during initSync. Verify the route handler returns different
    // data based on groupId by making direct requests.

    const grp1Result = await page.evaluate(async () => {
      const res = await fetch(
        "http://localhost:9999/workspaces/test-workspace/groups/grp-1/jira-status",
      );
      return res.json();
    });
    expect(grp1Result.status).toBe("In Progress");
    expect(grp1Result.comments).toHaveLength(2);

    const grp2Result = await page.evaluate(async () => {
      const res = await fetch(
        "http://localhost:9999/workspaces/test-workspace/groups/grp-2/jira-status",
      );
      return res.json();
    });
    expect(grp2Result.status).toBe("To Do");
    expect(grp2Result.comments).toHaveLength(0);

    // Verify both requests were captured
    const statusRequests = mockServer.requests("getJiraTicketStatus");
    // At least 2 from our manual fetches; the JIRA poller may add more
    expect(statusRequests.length).toBeGreaterThanOrEqual(2);
  });

  test("searchJiraUsers override responds with filtered users", async ({
    page,
    mockServer,
  }) => {
    // Override searchJiraUsers with a filter function that mimics real behavior
    mockServer.override("searchJiraUsers", (request) => {
      const url = new URL(request.url());
      const query = url.searchParams.get("query")?.toLowerCase() ?? "";
      return fixtures.searchJiraUsers.filter((u) =>
        u.displayName.toLowerCase().includes(query),
      );
    });

    // Verify the override works by making a direct fetch from the browser.
    // This does NOT trigger the @mention UI — it just proves the override
    // mechanism works.
    const filteredResult = await page.evaluate(async () => {
      const res = await fetch(
        "http://localhost:9999/jira/users?query=ali",
      );
      return res.json();
    });

    expect(filteredResult).toHaveLength(1);
    expect(filteredResult[0].displayName).toBe("Alice Cooper");

    // Verify an empty query returns all users
    const allResult = await page.evaluate(async () => {
      const res = await fetch(
        "http://localhost:9999/jira/users?query=",
      );
      return res.json();
    });

    expect(allResult).toHaveLength(3);

    // Verify the requests were captured
    const userRequests = mockServer.requests("searchJiraUsers");
    // At least the 2 we just made (there may be earlier ones from initSync)
    expect(userRequests.length).toBeGreaterThanOrEqual(2);
  });

  test("addJiraComment override captures request body", async ({
    page,
    mockServer,
  }) => {
    // Override addJiraComment to return a custom response
    const customResponse = {
      id: "jira-cmt-test-1",
      created: "2026-04-15T10:00:00.000Z",
    };

    mockServer.override("addJiraComment", () => customResponse);

    // Make a direct fetch to the comment endpoint from the browser
    const result = await page.evaluate(async () => {
      const res = await fetch(
        "http://localhost:9999/workspaces/test-workspace/groups/grp-1/jira-comment",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: "Test comment from E2E",
            parentId: null,
          }),
        },
      );
      return res.json();
    });

    // Verify the custom response was returned
    expect(result).toEqual(customResponse);

    // Verify the request was captured with the correct body
    const commentRequests = mockServer.requests("addJiraComment");
    expect(commentRequests.length).toBeGreaterThanOrEqual(1);

    const lastRequest = commentRequests[commentRequests.length - 1];
    expect(lastRequest.method).toBe("POST");
    expect(lastRequest.body).toEqual({
      body: "Test comment from E2E",
      parentId: null,
    });
    expect(lastRequest.url).toContain("/groups/grp-1/jira-comment");
  });
});
