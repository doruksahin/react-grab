import { test, expect, type ReactGrabPageObject } from "../fixtures.js";
import type { Locator, Page } from "@playwright/test";

/**
 * ADR-0022: the overlay's look is reviewed by image. One screenshot per
 * surface, against the mock server's seeded data. The clock is fixed so
 * relative dates ("303d ago") do not change from day to day.
 *
 * After a deliberate look change, update the baselines with
 * `--update-snapshots` and review the image diff in the report.
 */

const FIXED_NOW = new Date("2026-11-15T09:00:00Z");

test.use({ viewport: { width: 1440, height: 900 } });

// The pointer stays where the last click left it, so a hover tooltip may or
// may not be open; park it in a corner and wait for tooltips to close.
const expectPageShot = async (
  page: Page,
  name: string,
  extraMasks: Locator[] = [],
) => {
  await page.mouse.move(1, 1);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(page).toHaveScreenshot(name, {
    animations: "disabled",
    caret: "hide",
    mask: extraMasks,
    // The toolbar can still land a pixel or two apart (about 0.07% of the
    // page); it has its own strict element shot. Any token or layout change
    // moves far more than 0.1% of the page.
    maxDiffPixelRatio: 0.001,
  });
};

const openDashboard = async (page: Page) => {
  await page.locator("[data-react-grab-toolbar-dashboard]").click();
  return page.getByRole("dialog", { name: "React Grab Dashboard" });
};

// When the sync dot appears the toolbar grows and slides back to its
// remembered position (a 300 ms transition); wait until it stops moving.
const waitForToolbarToSettle = async (page: Page) => {
  const toolbar = page.locator("[data-react-grab-toolbar]");
  const recent: string[] = [];
  await expect
    .poll(
      async () => {
        recent.push(JSON.stringify(await toolbar.boundingBox()));
        const lastThree = recent.slice(-3);
        return lastThree.length === 3 && new Set(lastThree).size === 1;
      },
      { timeout: 8000, intervals: [200] },
    )
    .toBe(true);
};

const startSynced = async (page: Page, reactGrab: ReactGrabPageObject) => {
  await page.clock.setFixedTime(FIXED_NOW);
  await reactGrab.triggerInitSync();
  await expect
    .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
    .toBe(true);
  await waitForToolbarToSettle(page);
};

test.describe("Overlay surfaces", { tag: ["@ADR-0022"] }, () => {
  test.beforeEach(async ({ page, reactGrab, mockServer: _mockServer }) => {
    await startSynced(page, reactGrab);
  });

  test("toolbar", async ({ page }) => {
    // A fractional x position shifts anti-aliased edge pixels slightly.
    await expect(page.locator("[data-react-grab-toolbar]")).toHaveScreenshot(
      "toolbar.png",
      { animations: "disabled", maxDiffPixels: 60 },
    );
  });

  test("page with saved labels", async ({ page }) => {
    await expectPageShot(page, "page-with-labels.png");
  });

  test("comment composer", async ({ page, reactGrab }) => {
    await reactGrab.registerCommentAction();
    await reactGrab.enterPromptMode("li:nth-child(2)");
    await reactGrab.typeInInput(
      "The price overlaps the badge on small screens",
    );
    await expectPageShot(page, "comment-composer.png");
  });

  test("comments menu", async ({ page, reactGrab }) => {
    await reactGrab.clickCommentsButton();
    await expectPageShot(page, "comments-menu.png");
  });

  test("sidebar groups", async ({ page }) => {
    await openDashboard(page);
    await expectPageShot(page, "sidebar-groups.png");
  });

  test("sidebar selections", async ({ page }) => {
    const dashboard = await openDashboard(page);
    await dashboard.getByRole("button", { name: /^Selections/ }).click();
    await expectPageShot(page, "sidebar-selections.png");
  });

  test("Jira create dialog", async ({ page, reactGrab }) => {
    await reactGrab.registerCommentAction();
    await reactGrab.enterPromptMode("li:first-child");
    await reactGrab.typeInInput("Checkout button does nothing on Safari");
    await reactGrab.submitInput();
    const dashboard = await openDashboard(page);
    await dashboard.getByRole("button", { name: /^Selections/ }).click();
    await page
      .locator("[data-react-grab-selection-card]")
      .filter({ hasText: "Checkout button" })
      .locator("[data-react-grab-create-ticket]")
      .click();
    await expect(page.locator("[data-react-grab-jira-form]")).toBeVisible();
    // The list behind the dialog is still settling around the new card;
    // the sidebar has its own shots, so only the dialog is compared here.
    await expectPageShot(page, "jira-dialog.png", [
      page.locator("[data-react-grab-sidebar]"),
    ]);
  });
});
