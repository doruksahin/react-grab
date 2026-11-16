import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures.js";
import * as fixtures from "../mocks/fixtures.js";

/**
 * The sidebar's status chips (ADR-0022 step 3, Sidebar board S4.1) and the
 * offline banner (S4.6, Gap 4), against the mock sync server.
 */

const openDashboard = async (page: Page) => {
  await page.locator("[data-react-grab-toolbar-dashboard]").click();
  return page.getByRole("dialog", { name: "React Grab Dashboard" });
};

test.describe(
  "Sidebar status chips",
  { tag: ["@SPEC-006", "@ADR-0022"] },
  () => {
    test.beforeEach(async ({ reactGrab, mockServer: _mockServer }) => {
      await reactGrab.triggerInitSync();
      await expect
        .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
        .toBe(true);
    });

    test(
      "each status chip counts the selections in that status and narrows the list to them",
      {
        annotation: {
          type: "ac",
          description:
            "ADR-0022 step 3: the stats block becomes the status filter; chips count what the list shows",
        },
      },
      async ({ page }) => {
        const dashboard = await openDashboard(page);
        const chips = dashboard.locator("[data-react-grab-status-filter]");
        const groupCards = dashboard.locator(
          "[data-react-grab-group-collapsible]",
        );

        // Two selections, both in the In Progress group (ATT-101).
        await expect(
          chips.getByRole("button", { name: "All (2)" }),
        ).toHaveAttribute("aria-pressed", "true");
        await expect(groupCards).toHaveCount(3);

        await chips.getByRole("button", { name: "In Progress (2)" }).click();
        await expect(groupCards).toHaveCount(1);
        await expect(groupCards).toContainText("Header alignment issue");
        await expect(
          chips.getByRole("button", { name: "In Progress (2)" }),
        ).toHaveAttribute("aria-pressed", "true");

        // The chips and the filter menu share one filter state.
        await expect(
          dashboard.locator("[data-react-grab-filter-badge]"),
        ).toHaveText("1");

        // Pressing the selected chip again shows every status.
        await chips.getByRole("button", { name: "In Progress (2)" }).click();
        await expect(groupCards).toHaveCount(3);
        await expect(
          chips.getByRole("button", { name: "All (2)" }),
        ).toHaveAttribute("aria-pressed", "true");
      },
    );
  },
);

test.describe("Sidebar offline banner", { tag: ["@ADR-0022"] }, () => {
  test.beforeEach(async ({ reactGrab, mockServer }) => {
    mockServer.override("listGroups", () => null);
    await reactGrab.triggerInitSync();
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);
  });

  test(
    "Retry connects again and the list fills once the server answers",
    {
      annotation: {
        type: "ac",
        description:
          "ADR-0022 step 3, Sidebar S4.6: Retry has to actually retry",
      },
    },
    async ({ page, mockServer }) => {
      const dashboard = await openDashboard(page);
      const banner = dashboard.locator("[data-react-grab-sync-offline-banner]");
      await expect(banner).toBeVisible();
      await expect(banner).toHaveAttribute("role", "alert");
      // The list stays usable under the banner.
      await expect(
        dashboard.locator("[data-react-grab-sidebar-search]"),
      ).toBeVisible();
      await expect(
        dashboard.locator("[data-react-grab-group-collapsible]"),
      ).toHaveCount(0);

      // Still down: the banner stays.
      await dashboard.getByRole("button", { name: "Retry" }).click();
      await expect.poll(() => mockServer.requests("listGroups").length).toBe(2);
      await expect(
        dashboard.getByRole("button", { name: "Retry" }),
      ).toBeEnabled();
      await expect(banner).toBeVisible();

      // Back up: the banner goes and the server's groups load.
      mockServer.override("listGroups", fixtures.groups);
      await dashboard.getByRole("button", { name: "Retry" }).click();
      await expect(banner).toHaveCount(0);
      await expect(
        dashboard.locator("[data-react-grab-group-collapsible]"),
      ).toHaveCount(3);
      expect(mockServer.requests("listGroups")).toHaveLength(3);
    },
  );
});
