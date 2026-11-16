import { readFile } from "node:fs/promises";
import { parse } from "@puppeteer/replay";
import { test, expect } from "../fixtures.js";
import type { CommentItem } from "../../src/types.js";
import type { SelectionGroupWithJira } from "../../src/features/selection-groups/types.js";
import { comments as fixtureComments } from "../mocks/fixtures.js";
import { openGroupDetail } from "../open-group-detail.js";

/**
 * ADR-0025, phase 3: a selection card lists the steps that led to it and
 * downloads them as a Chrome DevTools Recorder flow.
 */

const groups: SelectionGroupWithJira[] = [
  { id: "billing", name: "Billing", createdAt: 1, revealed: false },
];

const [base] = fixtureComments;

const withSteps: CommentItem = {
  ...base,
  id: "with-steps",
  groupId: "billing",
  commentText: "Plan price is cut off",
  jiraTicketId: undefined,
  status: "open",
  steps: [
    { type: "navigate", url: "https://app.example.com/settings" },
    {
      type: "click",
      selectors: ['aria/Billing[role="tab"]', "#billing-tab"],
      offsetX: 4,
      offsetY: 6,
      assertedEvents: [
        { type: "navigation", url: "https://app.example.com/settings/billing" },
      ],
    },
    { type: "change", selectors: ['aria/Coupon[role="textbox"]'], value: "" },
  ],
};

const withoutSteps: CommentItem = {
  ...withSteps,
  id: "without-steps",
  commentText: "Footer overlaps",
  steps: undefined,
};

test.describe("Reproduce steps in the sidebar", { tag: ["@ADR-0025"] }, () => {
  test.beforeEach(async ({ page, reactGrab }) => {
    await reactGrab.populate({ groups, comments: [withSteps, withoutSteps] });
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);
    await page.locator("[data-react-grab-toolbar-dashboard]").click();
    await openGroupDetail(page, "Billing");
  });

  test("a card lists its steps in readable form", async ({
    page,
    reactGrab,
  }) => {
    const card = page
      .locator("[data-react-grab-selection-card]")
      .filter({ hasText: "Plan price is cut off" });
    await card.getByRole("button", { name: "Steps (3)" }).click();

    await expect(
      card.locator("[data-react-grab-reproduce-steps-item]"),
    ).toHaveText([
      "Open /settings",
      "Click “Billing” (tab) → /settings/billing",
      "Change “Coupon” (textbox, value not saved)",
    ]);
    await reactGrab.screenshot("steps-open", "page");
  });

  test("a card without steps shows no step list", async ({ page }) => {
    const card = page
      .locator("[data-react-grab-selection-card]")
      .filter({ hasText: "Footer overlaps" });
    await expect(card).toBeVisible();
    await expect(card.locator("[data-react-grab-reproduce-steps]")).toHaveCount(
      0,
    );
  });

  test("the flow downloads as a file DevTools Recorder accepts", async ({
    page,
  }) => {
    const card = page
      .locator("[data-react-grab-selection-card]")
      .filter({ hasText: "Plan price is cut off" });
    await card.getByRole("button", { name: "Steps (3)" }).click();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      card.locator("[data-react-grab-reproduce-steps-download]").click(),
    ]);
    expect(download.suggestedFilename()).toBe(
      "react-grab-steps-with-steps.json",
    );
    const path = await download.path();
    const flow: unknown = JSON.parse(await readFile(path, "utf8"));
    expect(flow).toEqual({
      title: "Plan price is cut off",
      steps: withSteps.steps,
    });
    expect(() => parse(flow)).not.toThrow();
  });
});
