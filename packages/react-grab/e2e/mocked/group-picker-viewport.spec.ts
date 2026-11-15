import { test, expect } from "../fixtures.js";
import type { Page } from "@playwright/test";

/**
 * S3.5 / Gap 3: the group picker opened from a selection label near the
 * viewport edge must stay fully visible (it used to clip 189 px on the right
 * and 113 px at the bottom). Placement is on Floating UI (flip + shift + size).
 */

const VIEWPORT = { width: 480, height: 360 };

const EDGE_TARGETS = {
  right: { right: "4px", top: "120px" },
  bottom: { left: "40px", bottom: "4px" },
} as const;

const addTarget = async (page: Page, placement: Record<string, string>) => {
  await page.evaluate((style) => {
    const target = document.createElement("button");
    target.dataset.testid = "edge-target";
    target.textContent = "Edge";
    Object.assign(target.style, {
      position: "fixed",
      width: "60px",
      height: "24px",
      zIndex: "1",
      ...style,
    });
    document.body.append(target);
  }, placement);
};

test.describe(
  "Group picker stays inside the viewport",
  { tag: ["@S3.5"] },
  () => {
    test.use({ viewport: VIEWPORT });

    for (const [edge, placement] of Object.entries(EDGE_TARGETS)) {
      test(`opened from a label at the ${edge} edge`, async ({
        page,
        reactGrab,
      }) => {
        await addTarget(page, placement);
        await reactGrab.registerCommentAction();
        await reactGrab.enterPromptMode("[data-testid='edge-target']");

        await page
          .locator(
            "[data-react-grab-selection-label] [data-react-grab-active-group-picker] button",
          )
          .first()
          .click();

        const flyout = page.locator("[data-react-grab-group-picker-flyout]");
        await expect(flyout).toBeVisible();
        await expect
          .poll(async () => {
            const box = await flyout.boundingBox();
            if (!box) return false;
            return (
              box.x >= 0 &&
              box.y >= 0 &&
              box.x + box.width <= VIEWPORT.width &&
              box.y + box.height <= VIEWPORT.height
            );
          })
          .toBe(true);
      });
    }
  },
);
