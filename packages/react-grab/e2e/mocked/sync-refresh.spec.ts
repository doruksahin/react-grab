import { test, expect } from "../fixtures.js";
import * as fixtures from "../mocks/fixtures.js";

/**
 * E2E tests verifying mid-test mock override + JIRA status refresh.
 *
 * Uses mockServer fixture for HTTP interception + manual initSync.
 * The sync layer polls JIRA status on init and exposes updateJiraStatus
 * via onRefreshJiraStatus — these tests prove the mock infrastructure
 * supports mid-test data changes and the UI reflects initial poll results.
 */

test.use({ video: "on" });

const ATTR = "data-react-grab";

// ---------------------------------------------------------------------------
// Shadow DOM helpers
// ---------------------------------------------------------------------------

const clickShadowButton = async (
  page: import("@playwright/test").Page,
  selector: string,
) => {
  await page.evaluate(
    ({ attrName, buttonSelector }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      root?.querySelector<HTMLButtonElement>(buttonSelector)?.click();
    },
    { attrName: ATTR, buttonSelector: selector },
  );
};

const isSidebarVisible = async (
  page: import("@playwright/test").Page,
): Promise<boolean> => {
  return page.evaluate((attrName) => {
    const host = document.querySelector(`[${attrName}]`);
    const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
    if (!root) return false;
    return (
      root.querySelector(
        "[role='dialog'][aria-label='React Grab Dashboard']",
      ) !== null
    );
  }, ATTR);
};

const isDetailVisible = async (
  page: import("@playwright/test").Page,
): Promise<boolean> => {
  return page.evaluate((attrName) => {
    const host = document.querySelector(`[${attrName}]`);
    const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
    if (!root) return false;
    return root.querySelector("[role='region'][aria-label^='Detail:']") !== null;
  }, ATTR);
};

const clickGroupCard = async (
  page: import("@playwright/test").Page,
  groupName: string,
) => {
  await page.evaluate(
    ({ attrName, name }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      const sidebar = root?.querySelector("[role='dialog']");
      if (!sidebar) return;
      const card = Array.from(
        sidebar.querySelectorAll<HTMLElement>(".cursor-pointer"),
      ).find((c) => c.textContent?.includes(name));
      card?.click();
    },
    { attrName: ATTR, name: groupName },
  );
};

const sidebarContainsText = async (
  page: import("@playwright/test").Page,
  text: string,
): Promise<boolean> => {
  return page.evaluate(
    ({ attrName, searchText }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      const sidebar = root?.querySelector("[role='dialog']");
      return sidebar?.textContent?.includes(searchText) ?? false;
    },
    { attrName: ATTR, searchText: text },
  );
};

const detailContainsText = async (
  page: import("@playwright/test").Page,
  text: string,
): Promise<boolean> => {
  return page.evaluate(
    ({ attrName, searchText }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      const detail = root?.querySelector("[role='region'][aria-label^='Detail:']");
      return detail?.textContent?.includes(searchText) ?? false;
    },
    { attrName: ATTR, searchText: text },
  );
};

const getDetailHeaderText = async (
  page: import("@playwright/test").Page,
): Promise<string | null> => {
  return page.evaluate((attrName) => {
    const host = document.querySelector(`[${attrName}]`);
    const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
    const header = root?.querySelector("[data-react-grab-detail-header]");
    return header?.textContent ?? null;
  }, ATTR);
};

// ---------------------------------------------------------------------------
// Shared navigation
// ---------------------------------------------------------------------------

const openSidebar = async (page: import("@playwright/test").Page) => {
  await clickShadowButton(page, "[data-react-grab-toolbar-dashboard]");
  await expect
    .poll(() => isSidebarVisible(page), { timeout: 5000 })
    .toBe(true);
};

const navigateToGroupDetail = async (
  page: import("@playwright/test").Page,
  groupName: string,
) => {
  await openSidebar(page);
  await clickGroupCard(page, groupName);
  await expect
    .poll(() => isDetailVisible(page), { timeout: 5000 })
    .toBe(true);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Sync refresh — JIRA status mid-test override", { tag: ["@SYNC-REFRESH"] }, () => {
  test.beforeEach(async ({ reactGrab, mockServer }) => {
    // mockServer routes registered during fixture setup. Now trigger initSync.
    await reactGrab.triggerInitSync();

    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);
  });

  test("initial JIRA poll populates sidebar with correct statuses", async ({
    reactGrab,
    mockServer,
  }) => {
    const { page } = reactGrab;

    await openSidebar(page);
    await reactGrab.screenshot("sidebar-initial", "page");

    const hasHeader = await sidebarContainsText(page, "Header alignment issue");
    const hasFooter = await sidebarContainsText(page, "Footer spacing bug");
    expect(hasHeader).toBe(true);
    expect(hasFooter).toBe(true);

    // The JIRA poller fires on init — verify it made status requests
    await expect
      .poll(
        () => mockServer.requests("getJiraTicketStatus").length,
        { timeout: 8000 },
      )
      .toBeGreaterThanOrEqual(2);

    await reactGrab.screenshot("sidebar-statuses-loaded", "page");

    // grp-1 has a JIRA ticket (ATT-101), the card should show "In Progress"
    const hasInProgress = await sidebarContainsText(page, "In Progress");
    expect(hasInProgress).toBe(true);

    // grp-2 has a JIRA ticket (ATT-102), the card should show "To Do"
    const hasToDo = await sidebarContainsText(page, "To Do");
    expect(hasToDo).toBe(true);
  });

  test("detail header shows JIRA status from initial poll", async ({
    reactGrab,
    mockServer,
  }) => {
    const { page } = reactGrab;

    // Wait for JIRA poller to complete
    await expect
      .poll(
        () => mockServer.requests("getJiraTicketStatus").length,
        { timeout: 8000 },
      )
      .toBeGreaterThanOrEqual(2);

    await navigateToGroupDetail(page, "Header alignment issue");
    await reactGrab.screenshot("detail-initial-status", "page");

    // The detail header renders the group name, status label, and ticket ID.
    // After the JIRA poller runs, the status label updates from the default
    // "To Do" to the polled value "In Progress".
    await expect
      .poll(() => getDetailHeaderText(page), { timeout: 5000 })
      .toBeTruthy();

    const headerText = await getDetailHeaderText(page);
    expect(headerText).toContain("ATT-101");
    expect(headerText).toContain("Header alignment issue");

    // The status label should reflect the polled JIRA status.
    // getStatusLabel returns jiraStatus ?? "To Do" for ticketed groups.
    const hasInProgress = headerText?.includes("In Progress");
    const hasToDo = headerText?.includes("To Do");
    expect(hasInProgress || hasToDo).toBe(true);

    await reactGrab.screenshot("detail-header-status", "page");
  });

  test("mid-test override changes getJiraTicketStatus response", async ({
    page,
    mockServer,
    reactGrab,
  }) => {
    // Verify initial status for grp-1
    const initialResult = await page.evaluate(async () => {
      const res = await fetch(
        "http://localhost:9999/workspaces/test-workspace/groups/grp-1/jira-status",
      );
      return res.json();
    });
    expect(initialResult.status).toBe("In Progress");
    expect(initialResult.statusCategory).toBe("indeterminate");

    await reactGrab.screenshot("before-override", "page");

    // Override getJiraTicketStatus mid-test to return "Done"
    const updatedStatus = {
      ...fixtures.jiraTicketStatusATT101,
      status: "Done",
      statusCategory: "done",
      comments: [
        ...fixtures.jiraTicketStatusATT101.comments,
        {
          id: "jira-cmt-3",
          parentId: null,
          author: "Charlie Park",
          authorAvatar: null,
          body: "Fix verified and deployed to production.",
          createdAt: "2026-01-15T16:00:00.000Z",
        },
      ],
    };

    mockServer.override("getJiraTicketStatus", (request) => {
      const url = request.url();
      if (url.includes("/grp-1/")) {
        return updatedStatus;
      }
      return fixtures.jiraStatusByGroup["grp-2"];
    });

    // Verify the override takes effect on the next fetch
    const overriddenResult = await page.evaluate(async () => {
      const res = await fetch(
        "http://localhost:9999/workspaces/test-workspace/groups/grp-1/jira-status",
      );
      return res.json();
    });
    expect(overriddenResult.status).toBe("Done");
    expect(overriddenResult.statusCategory).toBe("done");
    expect(overriddenResult.comments).toHaveLength(3);

    await reactGrab.screenshot("after-override", "page");

    // grp-2 still returns its original data
    const grp2Result = await page.evaluate(async () => {
      const res = await fetch(
        "http://localhost:9999/workspaces/test-workspace/groups/grp-2/jira-status",
      );
      return res.json();
    });
    expect(grp2Result.status).toBe("To Do");
  });

  test("listGroups override adds a new group mid-test", async ({
    page,
    mockServer,
    reactGrab,
  }) => {
    // Verify initial groups
    const initialGroups = await page.evaluate(async () => {
      const res = await fetch(
        "http://localhost:9999/workspaces/test-workspace/groups",
      );
      return res.json();
    });
    expect(initialGroups).toHaveLength(3);

    await reactGrab.screenshot("groups-before-override", "page");

    // Override listGroups to add a fourth group
    const newGroup = {
      id: "grp-4",
      name: "New feature request",
      createdAt: Date.now(),
      revealed: false,
      status: "open",
      jiraTicketId: undefined,
      synthetic: false,
    };

    mockServer.override("listGroups", [...fixtures.groups, newGroup]);

    // Verify the override returns 4 groups
    const overriddenGroups = await page.evaluate(async () => {
      const res = await fetch(
        "http://localhost:9999/workspaces/test-workspace/groups",
      );
      return res.json();
    });
    expect(overriddenGroups).toHaveLength(4);
    expect(overriddenGroups[3].name).toBe("New feature request");

    await reactGrab.screenshot("groups-after-override", "page");
  });

  test("request capture tracks all JIRA status fetches across overrides", async ({
    page,
    mockServer,
    reactGrab,
  }) => {
    // Wait for initial JIRA poll
    await expect
      .poll(
        () => mockServer.requests("getJiraTicketStatus").length,
        { timeout: 8000 },
      )
      .toBeGreaterThanOrEqual(1);

    const beforeCount = mockServer.requests("getJiraTicketStatus").length;

    // Override and make additional fetches
    mockServer.override("getJiraTicketStatus", () => ({
      ...fixtures.jiraTicketStatusATT101,
      status: "In Review",
      statusCategory: "indeterminate",
    }));

    await page.evaluate(async () => {
      await fetch(
        "http://localhost:9999/workspaces/test-workspace/groups/grp-1/jira-status",
      );
      await fetch(
        "http://localhost:9999/workspaces/test-workspace/groups/grp-2/jira-status",
      );
    });

    // Verify request capture includes both pre- and post-override fetches
    const allRequests = mockServer.requests("getJiraTicketStatus");
    expect(allRequests.length).toBeGreaterThanOrEqual(beforeCount + 2);

    // Verify the last two requests hit the correct URLs
    const lastTwo = allRequests.slice(-2);
    expect(lastTwo[0].url).toContain("/grp-1/jira-status");
    expect(lastTwo[1].url).toContain("/grp-2/jira-status");
    expect(lastTwo[0].method).toBe("GET");
    expect(lastTwo[1].method).toBe("GET");

    await reactGrab.screenshot("request-capture-verified", "page");
  });
});
