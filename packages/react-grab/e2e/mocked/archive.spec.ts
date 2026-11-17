import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures.js";
import { openGroupDetail } from "../open-group-detail.js";
import * as fixtures from "../mocks/fixtures.js";

/**
 * ADR-0030: archive is the step before delete. A group, with or without a
 * ticket, is archived as a whole; a loose selection on its own. Archived
 * things leave the comments menu and the sidebar's list, show in the
 * sidebar's Archived section, and come back with Restore or Undo. Without a
 * ticket they can also be deleted from there, for good.
 */

const SELECTION = "Navigation bar is misaligned on mobile viewports";

const panel = (page: Page) =>
  page.locator("[data-react-grab-comments-dropdown]");
const panelRow = (page: Page) =>
  panel(page)
    .locator("[data-react-grab-comment-item]")
    .filter({ hasText: SELECTION });
const dashboard = (page: Page) =>
  page.getByRole("dialog", { name: "React Grab Dashboard" });
const archivedSection = (page: Page) =>
  dashboard(page).locator("[data-react-grab-archived-section]");
const toast = (page: Page) => page.locator("[data-react-grab-toast]");

const archiveFromPanel = async (page: Page) => {
  const row = panelRow(page);
  await row.hover();
  await row.getByRole("button", { name: "Selection actions" }).click();
  await page
    .getByRole("menuitem", { name: "Archive group (2 comments)" })
    .click();
};

test.describe("Archive", { tag: ["@ADR-0030"] }, () => {
  test.beforeEach(async ({ reactGrab, mockServer: _mockServer }) => {
    await reactGrab.triggerInitSync();
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);
    await reactGrab.clickCommentsButton();
  });

  test("archiving a ticketed group takes it off the comments menu", async ({
    page,
    mockServer,
  }) => {
    await archiveFromPanel(page);

    await expect(panelRow(page)).toHaveCount(0);
    await expect(toast(page)).toContainText("ATT-101 archived");
    expect(mockServer.requests("archiveGroup")).toHaveLength(1);
  });

  test("the sidebar lists it under Archived, and Restore brings it back", async ({
    page,
    mockServer,
  }) => {
    await archiveFromPanel(page);
    await page.keyboard.press("Escape");
    await page.locator("[data-react-grab-toolbar-dashboard]").click();

    const groupCards = dashboard(page).locator(
      "[data-react-grab-group-collapsible]",
    );
    await expect(
      groupCards.filter({ hasText: "Header alignment issue" }),
    ).toHaveCount(0);
    await expect(archivedSection(page)).toContainText("Archived");
    await archivedSection(page).getByText("Archived", { exact: true }).click();

    const archivedRow = archivedSection(page)
      .locator("[data-react-grab-selection-card]")
      .filter({ hasText: SELECTION });
    await archivedRow.hover();
    await archivedRow
      .getByRole("button", { name: "Selection actions" })
      .click();
    await page
      .getByRole("menuitem", { name: "Restore group (2 comments)" })
      .click();

    await expect(archivedSection(page)).toHaveCount(0);
    await expect(
      groupCards.filter({ hasText: "Header alignment issue" }),
    ).toHaveCount(1);
    expect(mockServer.requests("restoreGroup")).toHaveLength(1);
  });

  test("a ticketed group's header archives the whole group", async ({
    page,
    mockServer,
  }) => {
    await page.keyboard.press("Escape");
    await page.locator("[data-react-grab-toolbar-dashboard]").click();
    const group = dashboard(page)
      .locator("[data-react-grab-group-collapsible]")
      .filter({ hasText: "Header alignment issue" });
    await group.hover();
    await group.getByRole("button", { name: "Archive group" }).click();

    await expect(group).toHaveCount(0);
    await expect(archivedSection(page)).toContainText("2");
    expect(mockServer.requests("archiveGroup")).toHaveLength(1);
  });

  test("the group detail view archives the whole group", async ({
    page,
    mockServer,
  }) => {
    await page.keyboard.press("Escape");
    await page.locator("[data-react-grab-toolbar-dashboard]").click();
    await openGroupDetail(page, "Header alignment issue");
    await page.locator("[data-react-grab-group-detail-archive]").click();

    await expect(page.locator("[data-react-grab-group-detail]")).toHaveCount(0);
    await expect(archivedSection(page)).toContainText("2");
    expect(mockServer.requests("archiveGroup")).toHaveLength(1);
  });

  test("Undo in the toast restores it", async ({ page, mockServer }) => {
    await archiveFromPanel(page);
    await toast(page).locator("[data-react-grab-toast-action]").click();

    await expect(panelRow(page)).toHaveCount(1);
    expect(mockServer.requests("restoreGroup")).toHaveLength(1);
  });
});

const LOOSE = "Search field loses focus on typing";
const OPEN_GROUP_SELECTION = "Sidebar scrolls the whole page";

// A loose selection lives in its own synthetic group (ADR-0008); this one
// and the real group grp-3 have no ticket.
const looseGroup = {
  id: "grp-loose",
  name: "SearchField",
  createdAt: fixtures.groups[0].createdAt,
  revealed: false,
  synthetic: true,
};
const looseComment = {
  ...fixtures.comments[0],
  id: "cmt-loose",
  groupId: looseGroup.id,
  commentText: LOOSE,
  status: "open",
  jiraTicketId: undefined,
};
const openGroupComment = {
  ...fixtures.comments[0],
  id: "cmt-open",
  groupId: "grp-3",
  commentText: OPEN_GROUP_SELECTION,
  status: "open",
  jiraTicketId: undefined,
};

const withArchived = (groups: typeof fixtures.groups, archivedIds: string[]) =>
  groups.map((group) =>
    archivedIds.includes(group.id) ? { ...group, archivedAt: 1 } : group,
  );

const start = async (reactGrab: {
  triggerInitSync: () => Promise<void>;
  isToolbarVisible: () => Promise<boolean>;
}) => {
  await reactGrab.triggerInitSync();
  await expect
    .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
    .toBe(true);
};

const openArchivedSection = async (page: Page) => {
  await page.locator("[data-react-grab-toolbar-dashboard]").click();
  await archivedSection(page).getByText("Archived", { exact: true }).click();
};

const openArchivedRowMenu = async (page: Page, text: string) => {
  const row = archivedSection(page)
    .locator("[data-react-grab-selection-card]")
    .filter({ hasText: text });
  await row.hover();
  await row.getByRole("button", { name: "Selection actions" }).click();
};

test.describe("Archive before delete", { tag: ["@ADR-0030"] }, () => {
  test("a loose selection without a ticket is archived through its own group", async ({
    page,
    reactGrab,
    mockServer,
  }) => {
    mockServer.override("listGroups", [...fixtures.groups, looseGroup]);
    mockServer.override("listComments", [...fixtures.comments, looseComment]);
    mockServer.override("archiveGroup", { ...looseGroup, archivedAt: 2 });
    await start(reactGrab);
    await reactGrab.clickCommentsButton();

    const row = panel(page)
      .locator("[data-react-grab-comment-item]")
      .filter({ hasText: LOOSE });
    await row.hover();
    await row.getByRole("button", { name: "Selection actions" }).click();
    await page.getByRole("menuitem", { name: "Archive", exact: true }).click();

    await expect(row).toHaveCount(0);
    const [request] = mockServer.requests("archiveGroup");
    expect(request.url).toContain("/groups/grp-loose/archive");
  });

  test("an archived loose selection without a ticket can be removed", async ({
    page,
    reactGrab,
    mockServer,
  }) => {
    mockServer.override("listGroups", [
      ...fixtures.groups,
      { ...looseGroup, archivedAt: 1 },
    ]);
    mockServer.override("listComments", [...fixtures.comments, looseComment]);
    await start(reactGrab);
    await openArchivedSection(page);
    await openArchivedRowMenu(page, LOOSE);

    await expect(
      page.getByRole("menuitem", { name: "Restore", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: /Delete group/ }),
    ).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Remove selection" }).click();

    await expect(archivedSection(page)).toHaveCount(0);
    await expect
      .poll(() => mockServer.requests("deleteComment").length)
      .toBe(1);
  });

  test("an archived group without a ticket is deleted with its selections", async ({
    page,
    reactGrab,
    mockServer,
  }) => {
    mockServer.override("listGroups", withArchived(fixtures.groups, ["grp-3"]));
    mockServer.override("listComments", [
      ...fixtures.comments,
      openGroupComment,
    ]);
    await start(reactGrab);
    await openArchivedSection(page);
    // A selection never leaves an archived group on its own.
    await expect(
      archivedSection(page).getByRole("checkbox", {
        name: "Select for bulk actions",
      }),
    ).toHaveCount(0);
    await openArchivedRowMenu(page, OPEN_GROUP_SELECTION);

    await expect(
      page.getByRole("menuitem", { name: "Remove selection" }),
    ).toHaveCount(0);
    await page
      .getByRole("menuitem", { name: "Delete group (1 comment)" })
      .click();

    await expect(archivedSection(page)).toHaveCount(0);
    await expect(toast(page)).toContainText("Sidebar overflow deleted");
    await expect.poll(() => mockServer.requests("deleteGroup").length).toBe(1);
  });

  test("an archived group with a ticket can only be restored", async ({
    page,
    reactGrab,
    mockServer,
  }) => {
    mockServer.override("listGroups", withArchived(fixtures.groups, ["grp-1"]));
    await start(reactGrab);
    await openArchivedSection(page);
    await openArchivedRowMenu(page, SELECTION);

    await expect(
      page.getByRole("menuitem", { name: "Restore group (2 comments)" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: /Delete|Remove/ }),
    ).toHaveCount(0);
  });

  test("Clear all leaves archived selections alone", async ({
    page,
    reactGrab,
    mockServer,
  }) => {
    mockServer.override("listGroups", [
      ...withArchived(fixtures.groups, ["grp-3"]),
      looseGroup,
    ]);
    mockServer.override("listComments", [
      ...fixtures.comments,
      openGroupComment,
      looseComment,
    ]);
    await start(reactGrab);
    await reactGrab.clickCommentsButton();

    await page.locator("[data-react-grab-comments-clear]").click();

    await expect
      .poll(() => mockServer.requests("deleteComment").length)
      .toBe(1);
    expect(mockServer.requests("deleteComment")[0].url).toContain("cmt-loose");
    await page.locator("[data-react-grab-toolbar-dashboard]").click();
    await expect(archivedSection(page)).toContainText(OPEN_GROUP_SELECTION);
    expect(mockServer.requests("deleteComment")).toHaveLength(1);
  });
});
