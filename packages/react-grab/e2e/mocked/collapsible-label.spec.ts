import { test, expect } from "../fixtures.js";
import type { Page } from "@playwright/test";

/**
 * E2E for the collapsible-label feature.
 *
 * The feature is gated behind Options.collapsibleLabels. When enabled,
 * persistent label instances start collapsed as a small dot. Clicking
 * the dot expands to the full SelectionLabel. A chevron button inside
 * the label header collapses it back to the dot.
 */

test.use({ video: "on" });

const ATTR = "data-react-grab";

const countInShadow = async (page: Page, selector: string): Promise<number> => {
  return page.evaluate(
    ({ attrName, sel }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      if (!root) return 0;
      return root.querySelectorAll(sel).length;
    },
    { attrName: ATTR, sel: selector },
  );
};

const clickInShadow = async (page: Page, selector: string): Promise<void> => {
  await page.evaluate(
    ({ attrName, sel }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      const element = root?.querySelector(sel) as HTMLElement | null;
      element?.click();
    },
    { attrName: ATTR, sel: selector },
  );
};

test.describe("Collapsible Label", { tag: ["@SPEC-016"] }, () => {
  test("flag off — labels render expanded (no dot, no collapse button)", {
    annotation: { type: "ac", description: "SPEC-016 AC1-AC3" },
  }, async ({
    page,
    reactGrab,
  }) => {
    await reactGrab.populate();
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);

    await reactGrab.activate();
    await reactGrab.clickElement("nav.main-nav");
    await page.waitForTimeout(1500);

    await reactGrab.screenshot("flag-off-expanded", "page");

    const dotCount = await countInShadow(page, "[data-react-grab-collapsed-dot]");
    const labelCount = await countInShadow(page, "[data-react-grab-selection-label]");
    const collapseBtnCount = await countInShadow(page, "[data-react-grab-collapse-label]");

    expect(dotCount).toBe(0);
    expect(labelCount).toBeGreaterThan(0);
    expect(collapseBtnCount).toBe(0);
  });

  test("flag on — labels start as dots, click to expand, click chevron to collapse", {
    annotation: { type: "ac", description: "SPEC-016 AC6, AC11-AC14" },
  }, async ({
    page,
    reactGrab,
  }) => {
    // Turn on the feature flag — reinitialize the overlay with collapsibleLabels enabled
    await reactGrab.reinitialize({ collapsibleLabels: true });
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);
    await reactGrab.populate();

    // Give overlay time to render after reinit
    await page.waitForTimeout(500);

    // Activate via API (after reinit, __REACT_GRAB__ is fresh)
    await page.evaluate(() => {
      const api = (window as any).__REACT_GRAB__;
      api?.activate();
    });
    await page.waitForTimeout(500);

    await reactGrab.clickElement("nav.main-nav");
    await page.waitForTimeout(1500);

    // Initial state — all persistent labels should render as dots
    await reactGrab.screenshot("1-collapsed-dot-initial", "page");

    const initialDots = await countInShadow(page, "[data-react-grab-collapsed-dot]");
    const initialLabels = await countInShadow(page, "[data-react-grab-selection-label]");
    expect(initialDots).toBeGreaterThan(0);
    expect(initialLabels).toBe(0);

    // Click one dot to expand it
    await clickInShadow(page, "[data-react-grab-collapsed-dot]");
    await page.waitForTimeout(500);

    await reactGrab.screenshot("2-expanded-after-dot-click", "page");

    // After click: exactly one dot became a label; collapse button appears
    const expandedDots = await countInShadow(page, "[data-react-grab-collapsed-dot]");
    const expandedLabels = await countInShadow(page, "[data-react-grab-selection-label]");
    const collapseBtns = await countInShadow(page, "[data-react-grab-collapse-label]");
    expect(expandedDots).toBe(initialDots - 1);
    expect(expandedLabels).toBe(1);
    expect(collapseBtns).toBe(1);

    // Click the collapse chevron to collapse back to dot
    await clickInShadow(page, "[data-react-grab-collapse-label]");
    await page.waitForTimeout(500);

    await reactGrab.screenshot("3-collapsed-again-after-chevron", "page");

    const finalDots = await countInShadow(page, "[data-react-grab-collapsed-dot]");
    const finalLabels = await countInShadow(page, "[data-react-grab-selection-label]");
    expect(finalDots).toBe(initialDots);
    expect(finalLabels).toBe(0);
  });
});
