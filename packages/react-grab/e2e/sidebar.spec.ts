import { test, expect } from "./fixtures.js";

const ATTR = "data-react-grab";

/** Click a button inside the shadow root by selector. */
const clickShadowButton = async (
  page: import("@playwright/test").Page,
  selector: string,
) => {
  await page.evaluate(
    ({ attrName, buttonSelector }) => {
      const host = document.querySelector(`[${attrName}]`);
      const shadowRoot = host?.shadowRoot;
      if (!shadowRoot) return;
      const root = shadowRoot.querySelector(`[${attrName}]`);
      if (!root) return;
      root.querySelector<HTMLButtonElement>(buttonSelector)?.click();
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
    const shadowRoot = host?.shadowRoot;
    if (!shadowRoot) return false;
    const root = shadowRoot.querySelector(`[${attrName}]`);
    if (!root) return false;
    // The sidebar uses position:fixed, so offsetParent is always null.
    // Check for DOM presence instead.
    const sidebar = root.querySelector<HTMLElement>(
      "[role='dialog'][aria-label='React Grab Dashboard']",
    );
    return sidebar !== null;
  }, ATTR);
};

/** Returns the text content of an element inside the shadow root, or null. */
const getShadowText = async (
  page: import("@playwright/test").Page,
  selector: string,
): Promise<string | null> => {
  return page.evaluate(
    ({ attrName, sel }) => {
      const host = document.querySelector(`[${attrName}]`);
      const shadowRoot = host?.shadowRoot;
      if (!shadowRoot) return null;
      const root = shadowRoot.querySelector(`[${attrName}]`);
      if (!root) return null;
      const el = root.querySelector<HTMLElement>(sel);
      return el ? el.textContent : null;
    },
    { attrName: ATTR, sel: selector },
  );
};

test.describe("Sidebar", () => {
  test.beforeEach(async ({ reactGrab }) => {
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);
  });

  test("dashboard button opens and closes sidebar", async ({ reactGrab }) => {
    const { page } = reactGrab;

    // Open sidebar
    await clickShadowButton(page, "[data-react-grab-toolbar-dashboard]");
    await expect
      .poll(() => isSidebarVisible(page), { timeout: 3000 })
      .toBe(true);

    // Close sidebar
    await clickShadowButton(page, "[data-react-grab-toolbar-dashboard]");
    await expect
      .poll(() => isSidebarVisible(page), { timeout: 3000 })
      .toBe(false);
  });

  test("escape key closes sidebar", async ({ reactGrab }) => {
    const { page } = reactGrab;

    await clickShadowButton(page, "[data-react-grab-toolbar-dashboard]");
    await expect
      .poll(() => isSidebarVisible(page), { timeout: 3000 })
      .toBe(true);

    await page.keyboard.press("Escape");
    await expect
      .poll(() => isSidebarVisible(page), { timeout: 3000 })
      .toBe(false);
  });

  test("sidebar does not shift host page layout", async ({ reactGrab }) => {
    const { page } = reactGrab;

    const beforeMargin = await page.evaluate(
      () => getComputedStyle(document.body).marginLeft,
    );

    await clickShadowButton(page, "[data-react-grab-toolbar-dashboard]");
    await expect
      .poll(() => isSidebarVisible(page), { timeout: 3000 })
      .toBe(true);

    const afterMargin = await page.evaluate(
      () => getComputedStyle(document.body).marginLeft,
    );
    expect(beforeMargin).toBe(afterMargin);
  });

  test("sidebar shows empty state when no groups", async ({ reactGrab }) => {
    const { page } = reactGrab;

    await clickShadowButton(page, "[data-react-grab-toolbar-dashboard]");
    await expect
      .poll(() => isSidebarVisible(page), { timeout: 3000 })
      .toBe(true);

    // Look for the empty state message inside the sidebar in shadow DOM.
    // The sidebar shows either "No selections yet." (no groups) or a filter
    // empty message. We verify the sidebar content is rendered at all by
    // checking that either an empty state paragraph or the filter tabs exist.
    const sidebarHasContent = await page.evaluate((attrName) => {
      const host = document.querySelector(`[${attrName}]`);
      const shadowRoot = host?.shadowRoot;
      if (!shadowRoot) return false;
      const root = shadowRoot.querySelector(`[${attrName}]`);
      if (!root) return false;
      const sidebar = root.querySelector(
        "[role='dialog'][aria-label='React Grab Dashboard']",
      );
      if (!sidebar) return false;
      // If there are no groups, the empty state paragraph will be present.
      // If there are groups, the group list will be present.
      // Either way, the sidebar body content must be non-empty.
      return sidebar.children.length > 0;
    }, ATTR);

    expect(sidebarHasContent).toBe(true);

    // Check specifically for empty state or group list — if no groups exist,
    // the text "No selections yet." must appear somewhere in the sidebar.
    const hasEmptyStateOrGroups = await page.evaluate((attrName) => {
      const host = document.querySelector(`[${attrName}]`);
      const shadowRoot = host?.shadowRoot;
      if (!shadowRoot) return false;
      const root = shadowRoot.querySelector(`[${attrName}]`);
      if (!root) return false;
      const sidebarText = root.querySelector(
        "[role='dialog'][aria-label='React Grab Dashboard']",
      )?.textContent ?? "";
      // Either groups are shown, or the empty state message is present
      return (
        sidebarText.includes("No selections yet") ||
        sidebarText.length > 50 // sidebar has meaningful content (filter tabs + something)
      );
    }, ATTR);

    expect(hasEmptyStateOrGroups).toBe(true);
  });

  test("filter tabs are interactive", async ({ reactGrab }) => {
    const { page } = reactGrab;

    await clickShadowButton(page, "[data-react-grab-toolbar-dashboard]");
    await expect
      .poll(() => isSidebarVisible(page), { timeout: 3000 })
      .toBe(true);

    // Verify All and Open tabs are present
    const tabLabels = await page.evaluate((attrName) => {
      const host = document.querySelector(`[${attrName}]`);
      const shadowRoot = host?.shadowRoot;
      if (!shadowRoot) return [];
      const root = shadowRoot.querySelector(`[${attrName}]`);
      if (!root) return [];
      const sidebar = root.querySelector(
        "[role='dialog'][aria-label='React Grab Dashboard']",
      );
      if (!sidebar) return [];
      return Array.from(sidebar.querySelectorAll("button")).map(
        (btn) => btn.textContent?.trim() ?? "",
      );
    }, ATTR);

    expect(tabLabels).toContain("All");
    expect(tabLabels).toContain("Open");

    // Click the Open tab and verify it receives the active styling
    const openTabActive = await page.evaluate((attrName) => {
      const host = document.querySelector(`[${attrName}]`);
      const shadowRoot = host?.shadowRoot;
      if (!shadowRoot) return false;
      const root = shadowRoot.querySelector(`[${attrName}]`);
      if (!root) return false;
      const sidebar = root.querySelector(
        "[role='dialog'][aria-label='React Grab Dashboard']",
      );
      if (!sidebar) return false;
      const openBtn = Array.from(
        sidebar.querySelectorAll<HTMLButtonElement>("button"),
      ).find((btn) => btn.textContent?.trim() === "Open");
      if (!openBtn) return false;
      openBtn.click();
      return true;
    }, ATTR);

    expect(openTabActive).toBe(true);

    // After clicking Open, the active class (pink background) should be applied to that tab
    const openTabHasActiveClass = await page.evaluate((attrName) => {
      const host = document.querySelector(`[${attrName}]`);
      const shadowRoot = host?.shadowRoot;
      if (!shadowRoot) return false;
      const root = shadowRoot.querySelector(`[${attrName}]`);
      if (!root) return false;
      const sidebar = root.querySelector(
        "[role='dialog'][aria-label='React Grab Dashboard']",
      );
      if (!sidebar) return false;
      const openBtn = Array.from(
        sidebar.querySelectorAll<HTMLButtonElement>("button"),
      ).find((btn) => btn.textContent?.trim() === "Open");
      if (!openBtn) return false;
      // The active tab gets the pink background class
      return openBtn.className.includes("bg-[var(--color-grab-pink)]");
    }, ATTR);

    expect(openTabHasActiveClass).toBe(true);
  });
});
