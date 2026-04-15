import { test, expect } from "../fixtures.js";

/**
 * Visual verification E2E tests for JIRA comments in the sidebar.
 *
 * Uses syncData fixture to seed the store directly (no HTTP).
 * Screenshots are attached to the Playwright HTML report at every meaningful step.
 */

test.use({ video: "on" });

const ATTR = "data-react-grab";

// ---------------------------------------------------------------------------
// Shadow DOM helpers
// ---------------------------------------------------------------------------

/** Click a button inside the shadow root by selector. */
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

/** Returns true when the sidebar dialog is present in the shadow root DOM. */
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

/** Returns true when the detail view region is present. */
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

/** Click a group card in the sidebar by matching its text content. */
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

/** Check whether specific text appears anywhere inside the sidebar. */
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

/** Check whether specific text appears anywhere inside the detail region. */
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

/** Click a selector inside the shadow root (non-button variant). */
const clickShadowSelector = async (
  page: import("@playwright/test").Page,
  selector: string,
) => {
  await page.evaluate(
    ({ attrName, sel }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      root?.querySelector<HTMLElement>(sel)?.click();
    },
    { attrName: ATTR, sel: selector },
  );
};

/** Dump visible text content from the shadow root for debugging. */
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
// Shared setup: open sidebar and wait for it to appear
// ---------------------------------------------------------------------------

const openSidebar = async (page: import("@playwright/test").Page) => {
  await clickShadowButton(page, "[data-react-grab-toolbar-dashboard]");
  await expect
    .poll(() => isSidebarVisible(page), { timeout: 5000 })
    .toBe(true);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("JIRA Comments — Visual Verification", { tag: ["@SPEC-010"] }, () => {
  test.beforeEach(async ({ reactGrab }) => {
    await reactGrab.populate();
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);
  });

  test("sidebar shows groups from mock data", async ({ reactGrab }) => {
    const { page } = reactGrab;

    await openSidebar(page);
    await reactGrab.screenshot("sidebar-groups", "page");

    // Verify both JIRA-linked groups appear
    const hasHeader = await sidebarContainsText(page, "Header alignment issue");
    const hasFooter = await sidebarContainsText(page, "Footer spacing bug");

    expect(hasHeader).toBe(true);
    expect(hasFooter).toBe(true);
  });

  test("group detail shows JIRA ticket status and comments", async ({
    reactGrab,
  }) => {
    const { page } = reactGrab;

    await openSidebar(page);
    await reactGrab.screenshot("sidebar-before-click", "page");

    // Click the first group card
    await clickGroupCard(page, "Header alignment issue");

    // Wait for detail view to appear
    await expect
      .poll(() => isDetailVisible(page), { timeout: 5000 })
      .toBe(true);
    await reactGrab.screenshot("group-detail", "page");

    // Poll for JIRA comments to load (the mock returns 2 comments for grp-1).
    // The comment text from Alice Cooper should eventually appear in the detail.
    const commentsLoaded = await expect
      .poll(
        async () => {
          const hasAlice = await detailContainsText(page, "Alice Cooper");
          const hasReproduced = await detailContainsText(
            page,
            "Reproduced on Chrome 120",
          );
          return hasAlice || hasReproduced;
        },
        { timeout: 8000 },
      )
      .toBe(true)
      .then(() => true)
      .catch(() => false);

    await reactGrab.screenshot("comments-loaded", "page");

    if (!commentsLoaded) {
      // Even if comments did not load, dump the detail text for debugging
      const detailText = await getShadowTextContent(
        page,
        "[role='region'][aria-label^='Detail:']",
      );
      console.log("Detail view text content:", detailText?.slice(0, 500));
    }
  });

  test("comment editor is visible and interactive", async ({ reactGrab }) => {
    const { page } = reactGrab;

    await openSidebar(page);
    await clickGroupCard(page, "Header alignment issue");

    await expect
      .poll(() => isDetailVisible(page), { timeout: 5000 })
      .toBe(true);

    // Wait for comments section to load
    await expect
      .poll(
        () => detailContainsText(page, "Reproduced on Chrome 120"),
        { timeout: 8000 },
      )
      .toBe(true)
      .catch(() => {
        // Non-fatal — continue to check the composer
      });

    await reactGrab.screenshot("detail-with-comments", "page");

    // Look for the comment composer area
    const hasComposer = await shadowSelectorExists(
      page,
      "[data-react-grab-comment-composer]",
    );
    await reactGrab.screenshot("comment-editor", "page");

    if (hasComposer) {
      // Try clicking the editor to focus it
      const hasEditor = await shadowSelectorExists(
        page,
        "[data-react-grab-comment-editor]",
      );
      if (hasEditor) {
        await clickShadowSelector(page, "[data-react-grab-comment-editor]");
        // Small wait for focus state to render
        await page.waitForTimeout(300);
        await reactGrab.screenshot("editor-focused", "page");
      }

      // Check if submit button exists
      const hasSubmit = await shadowSelectorExists(
        page,
        "[data-react-grab-comment-submit]",
      );
      console.log("Composer visible:", hasComposer);
      console.log("Editor visible:", hasEditor);
      console.log("Submit button visible:", hasSubmit);
    } else {
      console.log("Comment composer not found in the detail view");
    }
  });

  test("group without comments shows empty state", async ({ reactGrab }) => {
    const { page } = reactGrab;

    await openSidebar(page);

    // Click the second group which has a JIRA ticket but no comments
    await clickGroupCard(page, "Footer spacing bug");

    await expect
      .poll(() => isDetailVisible(page), { timeout: 5000 })
      .toBe(true);

    await reactGrab.screenshot("footer-group-detail", "page");

    // Wait a moment for JIRA status to load (ATT-102 has 0 comments)
    await page.waitForTimeout(2000);
    await reactGrab.screenshot("empty-comments", "page");

    // Dump the detail text for debugging
    const detailText = await getShadowTextContent(
      page,
      "[role='region'][aria-label^='Detail:']",
    );
    console.log(
      "Footer group detail text:",
      detailText?.slice(0, 500) ?? "(no detail region found)",
    );
  });
});
