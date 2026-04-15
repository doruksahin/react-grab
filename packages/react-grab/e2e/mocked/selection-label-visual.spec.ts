import { test, expect } from "../fixtures.js";

/**
 * Visual verification of the selection label — the floating popup
 * that appears when you click an element in the overlay.
 */
test.describe("Selection Label — Visual Verification", () => {
  test.beforeEach(async ({ reactGrab }) => {
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);
  });

  test("selection label appears when clicking an element", {
    annotation: { type: "ac", description: "Selection label renders on click" },
  }, async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.clickElement("li");
    await reactGrab.waitForSelectionLabel();
    await reactGrab.screenshot("selection-label-visible", "page");

    const info = await reactGrab.getSelectionLabelInfo();
    expect(info.isVisible).toBe(true);
    expect(info.tagName).toBeTruthy();

    await reactGrab.screenshot("selection-label-detail");
  });

  test("selection label shows element info", {
    annotation: { type: "ac", description: "Label shows tag name and component" },
  }, async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.clickElement("[data-testid='jira-nav-element']");
    await reactGrab.waitForSelectionLabel();
    await reactGrab.screenshot("nav-selection-label", "page");

    const info = await reactGrab.getSelectionLabelInfo();
    expect(info.isVisible).toBe(true);
    expect(info.tagName).toBeTruthy();
  });

  test("selection label shows on header element", {
    annotation: { type: "ac", description: "Label shows for header element" },
  }, async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.clickElement("[data-testid='jira-header-element']");
    await reactGrab.waitForSelectionLabel();
    await reactGrab.screenshot("header-selection-label", "page");
  });
});
