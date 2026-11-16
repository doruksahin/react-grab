import type { Page } from "@playwright/test";
import { test, expect, type ReactGrabPageObject } from "../fixtures.js";
import type { CommentItem } from "../../src/types.js";
import type { SelectionGroupWithJira } from "../../src/features/selection-groups/types.js";
import { comments as fixtureComments } from "../mocks/fixtures.js";

/**
 * ADR-0026: the guide highlights each recorded step's element and moves on
 * when the user acts; at the end it shows the selection. It never clicks.
 */

const ORIGIN = "http://localhost:5175";

const groups: SelectionGroupWithJira[] = [
  { id: "modal", name: "Modal", createdAt: 1, revealed: false },
];

const [base] = fixtureComments;

const insideModal = (navigateTo: string): CommentItem => ({
  ...base,
  id: "inside-modal",
  groupId: "modal",
  commentText: "Button inside the modal",
  pageUrl: `${ORIGIN}/`,
  elementSelectors: ['[data-testid="modal-inner-button"]'],
  jiraTicketId: undefined,
  status: "open",
  steps: [
    { type: "navigate", url: navigateTo },
    {
      type: "click",
      // Two buttons are named "Open Modal": the ARIA selector is ambiguous,
      // so the guide falls back to the CSS one.
      selectors: [
        'aria/Open Modal[role="button"]',
        '[data-testid="modal-trigger"]',
      ],
      offsetX: 10,
      offsetY: 10,
    },
  ],
});

const bar = (page: Page) => page.locator("[data-react-grab-step-guide]");

// The guide starts from the card's notice; a comments row only shows where
// the selection is.
const openGuide = async (page: Page, _reactGrab: ReactGrabPageObject) => {
  await page.locator("[data-react-grab-toolbar-dashboard]").click();
  await page
    .locator("[data-react-grab-selection-card]")
    .filter({ hasText: "Button inside the modal" })
    .locator("[data-react-grab-step-guide-start]")
    .click();
};

const seed = async (reactGrab: ReactGrabPageObject, item: CommentItem) => {
  await reactGrab.populate({ groups, comments: [item] });
  await expect
    .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
    .toBe(true);
};

test.describe("Step guide", { tag: ["@ADR-0026"] }, () => {
  test("highlights the next step and moves on when the user does it", async ({
    page,
    reactGrab,
  }) => {
    await seed(reactGrab, insideModal(`${ORIGIN}/`));
    await openGuide(page, reactGrab);

    await expect(bar(page)).toHaveAttribute(
      "data-react-grab-step-guide-status",
      "showing",
    );
    await expect(bar(page)).toContainText(
      "Step 1 of 1: Click “Open Modal” (button)",
    );
    await expect(page.getByTestId("modal-content")).toHaveCount(0);
    await expect(page.getByTestId("modal-trigger")).toBeInViewport();
    await reactGrab.screenshot("guide-step", "page");

    await page.getByTestId("modal-trigger").click();

    await expect(bar(page)).toHaveAttribute(
      "data-react-grab-step-guide-status",
      "found",
    );
    await expect(bar(page)).toContainText("Here is the selection.");
  });

  test("never acts on the page by itself", async ({ page, reactGrab }) => {
    await seed(reactGrab, insideModal(`${ORIGIN}/`));
    await openGuide(page, reactGrab);
    await expect(bar(page)).toHaveAttribute(
      "data-react-grab-step-guide-status",
      "showing",
    );
    await page.waitForTimeout(500);
    await expect(page.getByTestId("modal-content")).toHaveCount(0);
  });

  test("Stop ends the guide", async ({ page, reactGrab }) => {
    await seed(reactGrab, insideModal(`${ORIGIN}/`));
    await openGuide(page, reactGrab);
    await page.locator("[data-react-grab-step-guide-stop]").click();
    await expect(bar(page)).toHaveCount(0);
  });

  test("opens the first step's page and carries on there", async ({
    page,
    reactGrab,
  }) => {
    const item = insideModal(`${ORIGIN}/?start=guide`);
    await page.goto(`${ORIGIN}/other-page`);
    await seed(reactGrab, item);
    await openGuide(page, reactGrab);

    await page.waitForURL(`${ORIGIN}/?start=guide`);
    await seed(reactGrab, item);
    await expect(bar(page)).toHaveAttribute(
      "data-react-grab-step-guide-status",
      "showing",
    );
  });

  test("a click while React Grab is selecting does not advance", async ({
    page,
    reactGrab,
  }) => {
    await seed(reactGrab, insideModal(`${ORIGIN}/`));
    await openGuide(page, reactGrab);
    await expect(bar(page)).toHaveAttribute(
      "data-react-grab-step-guide-status",
      "showing",
    );

    await reactGrab.activate();
    await page.getByTestId("modal-trigger").click();
    await reactGrab.deactivate();

    await expect(bar(page)).toContainText("Step 1 of 1");
    await expect(bar(page)).toHaveAttribute(
      "data-react-grab-step-guide-status",
      "showing",
    );
  });

  test("finds an element that an attribute change reveals", async ({
    page,
    reactGrab,
  }) => {
    await page.evaluate(() => {
      const late = document.createElement("button");
      late.id = "late-target";
      late.textContent = "Late";
      late.hidden = true;
      document.body.prepend(late);
    });
    await seed(reactGrab, {
      ...insideModal(`${ORIGIN}/`),
      steps: [
        { type: "navigate", url: `${ORIGIN}/` },
        { type: "click", selectors: ["#late-target"], offsetX: 1, offsetY: 1 },
      ],
    });
    await openGuide(page, reactGrab);
    await expect(bar(page)).toHaveAttribute(
      "data-react-grab-step-guide-status",
      "looking",
    );

    await page.evaluate(() => {
      document.getElementById("late-target")?.removeAttribute("hidden");
    });
    await expect(bar(page)).toHaveAttribute(
      "data-react-grab-step-guide-status",
      "showing",
    );
  });

  test("Skip moves past a step without acting on it", async ({
    page,
    reactGrab,
  }) => {
    await seed(reactGrab, insideModal(`${ORIGIN}/`));
    await openGuide(page, reactGrab);
    await page.locator("[data-react-grab-step-guide-skip]").click();

    await expect(bar(page)).toHaveAttribute(
      "data-react-grab-step-guide-status",
      "missing",
    );
    await expect(page.getByTestId("modal-content")).toHaveCount(0);
  });

  test("the sidebar card says where it is and offers the guide", async ({
    page,
    reactGrab,
  }) => {
    await seed(reactGrab, { ...insideModal(`${ORIGIN}/`), groupId: null });
    await page.locator("[data-react-grab-toolbar-dashboard]").click();

    const card = page
      .locator("[data-react-grab-selection-card]")
      .filter({ hasText: "Button inside the modal" });
    await expect(
      card.locator("[data-react-grab-selection-location]"),
    ).toContainText("No longer on this page");

    await card.locator("[data-react-grab-step-guide-start]").click();
    await expect(bar(page)).toHaveAttribute(
      "data-react-grab-step-guide-status",
      "showing",
    );
  });
});
