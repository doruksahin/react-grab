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

    // Open the sidebar first so we can inspect its state.
    await clickShadowButton(page, "[data-react-grab-toolbar-dashboard]");
    await expect
      .poll(() => isSidebarVisible(page), { timeout: 3000 })
      .toBe(true);

    // Check whether the app already has groups — if it does, the empty state
    // cannot be shown and the test is skipped (not a bug, just wrong fixture state).
    const groupCount = await page.evaluate((attrName) => {
      const host = document.querySelector(`[${attrName}]`);
      const shadowRoot = host?.shadowRoot;
      if (!shadowRoot) return -1;
      const root = shadowRoot.querySelector(`[${attrName}]`);
      if (!root) return -1;
      const sidebar = root.querySelector(
        "[role='dialog'][aria-label='React Grab Dashboard']",
      );
      if (!sidebar) return -1;
      // StatsBar shows the group count as the first bold number inside the stats row.
      const boldNums = Array.from(
        sidebar.querySelectorAll<HTMLElement>(".text-lg.font-bold"),
      );
      const firstNum = boldNums[0];
      return firstNum ? parseInt(firstNum.textContent ?? "0", 10) : 0;
    }, ATTR);

    // If the e2e fixture already has groups we cannot test the empty state — skip.
    test.skip(groupCount > 0, "Skipping: e2e app has pre-existing groups; empty state cannot be shown");

    // This test assumes the e2e app has no pre-existing groups.
    // The empty state message "No selections yet" must appear when there are no groups.
    await expect
      .poll(
        () =>
          page.evaluate((attrName) => {
            const host = document.querySelector(`[${attrName}]`);
            const shadowRoot = host?.shadowRoot;
            if (!shadowRoot) return false;
            const root = shadowRoot.querySelector(`[${attrName}]`);
            if (!root) return false;
            const sidebar = root.querySelector(
              "[role='dialog'][aria-label='React Grab Dashboard']",
            );
            if (!sidebar) return false;
            const paragraphs = Array.from(sidebar.querySelectorAll("p"));
            return paragraphs.some((p) =>
              p.textContent?.includes("No selections yet"),
            );
          }, ATTR),
        { timeout: 3000 },
      )
      .toBe(true);
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

    // Wait for React state update to propagate after the click
    await page.waitForTimeout(100);

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
