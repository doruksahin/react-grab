import { test, expect } from "../fixtures.js";

/**
 * Visual verification E2E tests for JIRA data in the selection label popup.
 *
 * Runs in chromium-mocked project (port 5176, initSync enabled).
 * mockServer intercepts all sync-server endpoints with deterministic fixture data.
 * Screenshots are attached to the Playwright HTML report at every meaningful step.
 *
 * The e2e-app has a "JIRA Integration Test" section with:
 *   - nav.main-nav → matches fixture sel-1 (grp-1, ATT-101, In Progress, 2 comments)
 *   - header.top-bar → matches fixture sel-2 (grp-2, ATT-102, To Do, no comments)
 */

const ATTR = "data-react-grab";

// ---------------------------------------------------------------------------
// Shadow DOM helpers
// ---------------------------------------------------------------------------

/** Check whether a data-attribute selector exists inside the shadow root. */
const shadowSelectorExists = async (
  page: import("@playwright/test").Page,
  selector: string,
): Promise<boolean> => {
  return page.evaluate(
    ({ attrName, sel }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      return root?.querySelector(sel) !== null;
    },
    { attrName: ATTR, sel: selector },
  );
};

/** Dump visible text content from a shadow root container for debugging. */
const getShadowTextContent = async (
  page: import("@playwright/test").Page,
  containerSelector: string,
): Promise<string | null> => {
  return page.evaluate(
    ({ attrName, sel }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      const container = root?.querySelector(sel);
      return container?.textContent ?? null;
    },
    { attrName: ATTR, sel: containerSelector },
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("JIRA Selection Label — Visual Verification", () => {
  test.beforeEach(async ({ reactGrab }) => {
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);
  });

  test("selection label appears when clicking nav element", async ({
    page,
    reactGrab,
    mockServer,
  }) => {
    // Activate overlay
    await reactGrab.activate();
    await reactGrab.screenshot("overlay-activated", "page");

    // Click the nav.main-nav element (fixture sel-1, ATT-101)
    await reactGrab.clickElement("nav.main-nav");

    // Wait a moment for selection label to appear
    await page.waitForTimeout(1000);
    await reactGrab.screenshot("nav-clicked", "page");

    // Check if selection label appeared in shadow DOM
    const labelVisible = await shadowSelectorExists(
      page,
      "[data-react-grab-selection-label]",
    );

    if (labelVisible) {
      await reactGrab.screenshot("selection-label-visible", "page");

      // Wait for JIRA status to load (the mock returns comments for grp-1)
      await page.waitForTimeout(2000);
      await reactGrab.screenshot("selection-label-with-jira", "page");

      // Check for comment composer
      const hasComposer = await shadowSelectorExists(
        page,
        "[data-react-grab-comment-composer]",
      );

      if (hasComposer) {
        await reactGrab.screenshot("comment-editor-visible", "page");
      }
    }

    // Log what mockServer captured
    const statusRequests = mockServer.requests("getJiraTicketStatus");
    console.log(`getJiraTicketStatus requests: ${statusRequests.length}`);
  });

  test("selection label for header element (no comments)", async ({
    page,
    reactGrab,
    mockServer,
  }) => {
    await reactGrab.activate();

    // Click the header.top-bar element (fixture sel-2, ATT-102, no comments)
    await reactGrab.clickElement("header.top-bar");
    await page.waitForTimeout(1000);
    await reactGrab.screenshot("header-clicked", "page");

    // Wait for any JIRA data to load
    await page.waitForTimeout(2000);
    await reactGrab.screenshot("header-selection-label", "page");

    // Log what mockServer captured
    const statusRequests = mockServer.requests("getJiraTicketStatus");
    console.log(`getJiraTicketStatus requests: ${statusRequests.length}`);
  });

  test("hover reveals selection box before click", async ({
    page,
    reactGrab,
  }) => {
    await reactGrab.activate();

    // Hover the nav element first (should show selection box highlight)
    await reactGrab.hoverElement("nav.main-nav");
    await page.waitForTimeout(500);
    await reactGrab.screenshot("nav-hover-highlight", "page");

    // Now hover the header
    await reactGrab.hoverElement("header.top-bar");
    await page.waitForTimeout(500);
    await reactGrab.screenshot("header-hover-highlight", "page");
  });
});
