import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures.js";

/**
 * ADR-0030: a group with a Jira ticket is archived instead of deleted. It
 * leaves the comments menu and the sidebar's list, shows in the sidebar's
 * Archived section, and comes back with Restore or Undo.
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

  test("Undo in the toast restores it", async ({ page, mockServer }) => {
    await archiveFromPanel(page);
    await toast(page).locator("[data-react-grab-toast-action]").click();

    await expect(panelRow(page)).toHaveCount(1);
    expect(mockServer.requests("restoreGroup")).toHaveLength(1);
  });
});
