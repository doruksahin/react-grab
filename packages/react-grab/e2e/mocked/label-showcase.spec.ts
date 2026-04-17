/**
 * Visual showcase of all SelectionLabel presets and states.
 *
 * Uses populate() to seed the store with fixture data, then clicks target
 * elements to trigger label rendering. Screenshots are attached to the
 * Playwright HTML report for visual inspection.
 *
 * Target elements live in e2e-app's LabelShowcaseSection:
 *   - .showcase-ticketed-comments  → grp-1 (ATT-101, In Progress, 2 comments)
 *   - .showcase-ticketed-no-comments → grp-2 (ATT-102, To Do, no comments)
 *   - .showcase-ungrouped → grp-3 (no ticket, open)
 */
import { test, expect } from "../fixtures.js";
import * as mockFixtures from "../mocks/fixtures.js";

const showcaseComments: typeof mockFixtures.comments = [
  {
    id: "showcase-1",
    groupId: "grp-1",
    content: "<div>...</div>",
    elementName: "ShowcaseTicketed",
    tagName: "div",
    componentName: "TicketedWithComments",
    elementsCount: 1,
    elementSelectors: [".showcase-ticketed-comments"],
    commentText: "Ticketed selection with JIRA comments",
    timestamp: Date.now(),
    revealed: true,
    status: "ticketed",
    pageUrl: "http://localhost:5175",
    pageTitle: "E2E Test Page",
    screenshotFullPage: undefined,
    screenshotElement: undefined,
    jiraTicketId: "ATT-101",
    capturedBy: "Showcase",
  },
  {
    id: "showcase-2",
    groupId: "grp-2",
    content: "<div>...</div>",
    elementName: "ShowcaseNoComments",
    tagName: "div",
    componentName: "TicketedNoComments",
    elementsCount: 1,
    elementSelectors: [".showcase-ticketed-no-comments"],
    commentText: "Ticketed selection without comments",
    timestamp: Date.now(),
    revealed: true,
    status: "ticketed",
    pageUrl: "http://localhost:5175",
    pageTitle: "E2E Test Page",
    screenshotFullPage: undefined,
    screenshotElement: undefined,
    jiraTicketId: "ATT-102",
    capturedBy: "Showcase",
  },
  {
    id: "showcase-3",
    groupId: "grp-3",
    content: "<div>...</div>",
    elementName: "ShowcaseUngrouped",
    tagName: "div",
    componentName: "UngroupedLoose",
    elementsCount: 1,
    elementSelectors: [".showcase-ungrouped"],
    commentText: "Loose selection, no ticket",
    timestamp: Date.now(),
    revealed: true,
    status: "open",
    pageUrl: "http://localhost:5175",
    pageTitle: "E2E Test Page",
    screenshotFullPage: undefined,
    screenshotElement: undefined,
    jiraTicketId: undefined,
    capturedBy: "Showcase",
  },
];

test.describe("Label Showcase — visual preset gallery", () => {
  test.beforeEach(async ({ reactGrab }) => {
    await reactGrab.populate({
      comments: showcaseComments,
    });
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);
  });

  test("all three persisted label variants side by side", async ({
    page,
    reactGrab,
  }) => {
    // Scroll the showcase section into view
    await page.locator("[data-testid='label-showcase-section']").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await reactGrab.screenshot("showcase-section-visible", "page");

    // Activate overlay
    await reactGrab.activate();
    await page.waitForTimeout(500);
    await reactGrab.screenshot("showcase-overlay-active", "page");

    // Click each showcase element to create persisted labels
    await reactGrab.clickElement(".showcase-ticketed-comments");
    await page.waitForTimeout(800);
    await reactGrab.screenshot("showcase-ticketed-comments-label", "page");

    await reactGrab.clickElement(".showcase-ticketed-no-comments");
    await page.waitForTimeout(800);
    await reactGrab.screenshot("showcase-ticketed-no-comments-label", "page");

    await reactGrab.clickElement(".showcase-ungrouped");
    await page.waitForTimeout(800);
    await reactGrab.screenshot("showcase-ungrouped-label", "page");

    // Final: all three labels visible at once
    await page.waitForTimeout(1000);
    await reactGrab.screenshot("showcase-all-labels", "page");
  });

  test("hover label — pre-selection state", async ({
    page,
    reactGrab,
  }) => {
    await reactGrab.activate();
    await page.waitForTimeout(300);

    // Hover each element to show the hover/action-cycle label
    await reactGrab.hoverElement(".showcase-ticketed-comments");
    await page.waitForTimeout(500);
    await reactGrab.screenshot("showcase-hover-ticketed", "page");

    await reactGrab.hoverElement(".showcase-ungrouped");
    await page.waitForTimeout(500);
    await reactGrab.screenshot("showcase-hover-ungrouped", "page");
  });
});
