import { test, expect } from "./fixtures.js";

test.describe("Keyboard Navigation", () => {
  test("should navigate to next element with ArrowDown", async ({
    reactGrab,
  }) => {
    await reactGrab.activate();
    await reactGrab.hoverElement("li:first-child");
    await reactGrab.waitForSelectionBox();

    await reactGrab.page.keyboard.press("ArrowDown");
    await reactGrab.waitForSelectionBox();

    const isVisible = await reactGrab.isOverlayVisible();
    expect(isVisible).toBe(true);
  });

  test("should navigate to previous element with ArrowUp", async ({
    reactGrab,
  }) => {
    await reactGrab.activate();
    await reactGrab.hoverElement("li:nth-child(3)");
    await reactGrab.waitForSelectionBox();

    await reactGrab.page.keyboard.press("ArrowUp");
    await reactGrab.waitForSelectionBox();

    const isVisible = await reactGrab.isOverlayVisible();
    expect(isVisible).toBe(true);
  });

  test("should navigate to parent element with ArrowLeft", async ({
    reactGrab,
  }) => {
    await reactGrab.activate();
    await reactGrab.hoverElement("li:first-child");
    await reactGrab.waitForSelectionBox();

    await reactGrab.page.keyboard.press("ArrowLeft");
    await reactGrab.waitForSelectionBox();

    const isVisible = await reactGrab.isOverlayVisible();
    expect(isVisible).toBe(true);
  });

  test("should navigate to child element with ArrowRight", async ({
    reactGrab,
  }) => {
    await reactGrab.activate();
    await reactGrab.hoverElement("ul");
    await reactGrab.waitForSelectionBox();

    await reactGrab.page.keyboard.press("ArrowRight");
    await reactGrab.waitForSelectionBox();

    const isVisible = await reactGrab.isOverlayVisible();
    expect(isVisible).toBe(true);
  });

  test("should maintain activation during keyboard navigation", async ({
    reactGrab,
  }) => {
    await reactGrab.activate();
    await reactGrab.hoverElement("li:first-child");
    await reactGrab.waitForSelectionBox();

    await reactGrab.page.keyboard.press("ArrowDown");
    await reactGrab.page.keyboard.press("ArrowDown");
    await reactGrab.page.keyboard.press("ArrowUp");

    const isVisible = await reactGrab.isOverlayVisible();
    expect(isVisible).toBe(true);
  });

  test("should copy element after keyboard navigation with click", async ({
    reactGrab,
  }) => {
    await reactGrab.page.evaluate(() => navigator.clipboard.writeText(""));
    await reactGrab.activate();
    await reactGrab.hoverElement("[data-testid='todo-list'] li:first-child");
    await reactGrab.waitForSelectionBox();

    await reactGrab.page.keyboard.press("ArrowDown");
    const selectedText = await reactGrab.page.evaluate(
      () => window.__REACT_GRAB__?.getState().targetElement?.textContent,
    );
    expect(selectedText).toBeTruthy();
    await reactGrab.waitForSelectionBox();

    const box = await reactGrab.getSelectionBoxBounds();
    if (!box) throw new Error("Keyboard selection has no bounds");
    await reactGrab.page.mouse.click(
      box.x + box.width / 2,
      box.y + box.height / 2,
    );
    await expect
      .poll(() => reactGrab.getClipboardContent())
      .toContain(selectedText);
  });

  test("should copy keyboard-selected element when clicking after mouse movement", async ({
    reactGrab,
  }) => {
    await reactGrab.page.evaluate(() => navigator.clipboard.writeText(""));
    await reactGrab.activate();
    await reactGrab.hoverElement("[data-testid='todo-list'] li:first-child");
    await reactGrab.waitForSelectionBox();

    const initialBounds = await reactGrab.getSelectionBoxBounds();
    expect(initialBounds).not.toBeNull();

    await reactGrab.page.keyboard.press("ArrowUp");
    const selectedText = await reactGrab.page.evaluate(
      () => window.__REACT_GRAB__?.getState().targetElement?.textContent,
    );
    expect(selectedText).toBeTruthy();
    await reactGrab.waitForSelectionBox();

    const selectionBoundsAfterArrow = await reactGrab.getSelectionBoxBounds();
    expect(selectionBoundsAfterArrow).not.toBeNull();

    await reactGrab.page.mouse.move(10, 10);
    await reactGrab.page.waitForTimeout(50);

    await reactGrab.page.mouse.click(
      selectionBoundsAfterArrow!.x + selectionBoundsAfterArrow!.width / 2,
      selectionBoundsAfterArrow!.y + selectionBoundsAfterArrow!.height / 2,
    );
    await expect
      .poll(() => reactGrab.getClipboardContent())
      .toContain(selectedText);
  });

  test("should freeze selection when navigating with arrow keys", async ({
    reactGrab,
  }) => {
    await reactGrab.activate();
    await reactGrab.hoverElement("li:first-child");
    await reactGrab.waitForSelectionBox();

    await reactGrab.page.keyboard.press("ArrowDown");
    await reactGrab.waitForSelectionBox();

    await reactGrab.page.mouse.move(0, 0);
    await reactGrab.page.waitForTimeout(100);

    const isVisible = await reactGrab.isOverlayVisible();
    expect(isVisible).toBe(true);
  });
});

test.describe("Navigation History and Wrapping", () => {
  test("ArrowLeft should go back to previous element", async ({
    reactGrab,
  }) => {
    await reactGrab.activate();
    await reactGrab.hoverElement("li:first-child");
    await reactGrab.waitForSelectionBox();

    await reactGrab.pressArrowDown();
    await reactGrab.pressArrowDown();

    await reactGrab.pressArrowLeft();
    await reactGrab.waitForSelectionBox();

    const isVisible = await reactGrab.isSelectionBoxVisible();
    expect(isVisible).toBe(true);
  });

  test("multiple ArrowDown should navigate through siblings", async ({
    reactGrab,
  }) => {
    await reactGrab.activate();
    await reactGrab.hoverElement("li:first-child");
    await reactGrab.waitForSelectionBox();

    await reactGrab.pressArrowDown();
    await reactGrab.pressArrowDown();
    await reactGrab.pressArrowDown();
    await reactGrab.waitForSelectionBox();

    const isVisible = await reactGrab.isOverlayVisible();
    expect(isVisible).toBe(true);
  });

  test("ArrowUp at first sibling should stay on element", async ({
    reactGrab,
  }) => {
    await reactGrab.activate();
    await reactGrab.hoverElement("li:first-child");
    await reactGrab.waitForSelectionBox();

    await reactGrab.pressArrowUp();
    await reactGrab.waitForSelectionBox();

    const isVisible = await reactGrab.isSelectionBoxVisible();
    expect(isVisible).toBe(true);
  });

  test("ArrowDown at last sibling should stay on element", async ({
    reactGrab,
  }) => {
    await reactGrab.activate();
    await reactGrab.hoverElement("li:last-child");
    await reactGrab.waitForSelectionBox();

    await reactGrab.pressArrowDown();
    await reactGrab.waitForSelectionBox();

    const isVisible = await reactGrab.isSelectionBoxVisible();
    expect(isVisible).toBe(true);
  });

  test("navigation should work on deeply nested elements", async ({
    reactGrab,
  }) => {
    await reactGrab.activate();
    await reactGrab.hoverElement("[data-testid='deeply-nested-text']");
    await reactGrab.waitForSelectionBox();

    await reactGrab.pressArrowLeft();
    await reactGrab.waitForSelectionBox();

    const isVisible = await reactGrab.isSelectionBoxVisible();
    expect(isVisible).toBe(true);
  });

  test("keyboard navigation should update selection label", async ({
    reactGrab,
  }) => {
    await reactGrab.activate();
    await reactGrab.hoverElement("li:first-child");
    await reactGrab.waitForSelectionBox();

    const labelBefore = await reactGrab.getSelectionLabelInfo();

    await reactGrab.pressArrowLeft();
    await reactGrab.waitForSelectionBox();

    const labelAfter = await reactGrab.getSelectionLabelInfo();

    expect(labelBefore.isVisible).toBe(true);
    expect(labelAfter.isVisible).toBe(true);
  });
});

test.describe("ArrowUp Vertical Traversal", () => {
  test("ArrowUp should reach parent element from child", async ({
    reactGrab,
  }) => {
    await reactGrab.activate();
    await reactGrab.hoverElement(
      "[data-testid='todo-list'] li:first-child span",
    );
    await reactGrab.waitForSelectionBox();

    const initialLabel = await reactGrab.getSelectionLabelInfo();

    await reactGrab.pressArrowUp();
    await reactGrab.waitForSelectionBox();

    const afterUpLabel = await reactGrab.getSelectionLabelInfo();

    expect(initialLabel.tagName).toBe("span");
    expect(afterUpLabel.tagName).not.toBe("span");
    expect(afterUpLabel.isVisible).toBe(true);
  });

  test("repeated ArrowUp should not oscillate between elements", async ({
    reactGrab,
  }) => {
    await reactGrab.activate();
    await reactGrab.hoverElement("[data-testid='todo-list'] li:first-child");
    await reactGrab.waitForSelectionBox();

    const visitedTags: string[] = [];
    for (let step = 0; step < 8; step++) {
      await reactGrab.pressArrowUp();
      await reactGrab.page.waitForTimeout(50);
      const labelInfo = await reactGrab.getSelectionLabelInfo();
      if (!labelInfo.isVisible) break;
      visitedTags.push(labelInfo.tagName ?? "unknown");
    }

    let oscillationCount = 0;
    for (let index = 2; index < visitedTags.length; index++) {
      const isRepeatingTwoStepPattern =
        visitedTags[index] === visitedTags[index - 2] &&
        visitedTags[index] !== visitedTags[index - 1];
      if (isRepeatingTwoStepPattern) {
        oscillationCount++;
      }
    }
    expect(oscillationCount).toBeLessThan(2);
  });

  test("ArrowUp bounds should never shrink", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverElement("[data-testid='todo-list'] li:first-child");
    await reactGrab.waitForSelectionBox();

    let previousBounds = await reactGrab.getSelectionBoxBounds();
    expect(previousBounds).not.toBeNull();
    let boundsShrunk = false;

    for (let step = 0; step < 5; step++) {
      await reactGrab.pressArrowUp();
      await reactGrab.page.waitForTimeout(50);
      const currentBounds = await reactGrab.getSelectionBoxBounds();
      if (!currentBounds) break;

      const previousArea = previousBounds!.width * previousBounds!.height;
      const currentArea = currentBounds.width * currentBounds.height;
      if (currentArea < previousArea - 1) {
        boundsShrunk = true;
        break;
      }
      previousBounds = currentBounds;
    }

    expect(boundsShrunk).toBe(false);
  });

  test("ArrowDown should reverse ArrowUp and maintain selection", async ({
    reactGrab,
  }) => {
    await reactGrab.activate();
    await reactGrab.hoverElement("[data-testid='todo-list'] li:first-child");
    await reactGrab.waitForSelectionBox();

    await reactGrab.pressArrowUp();
    await reactGrab.waitForSelectionBox();
    await reactGrab.pressArrowUp();
    await reactGrab.waitForSelectionBox();

    const afterUpVisible = await reactGrab.isSelectionBoxVisible();
    expect(afterUpVisible).toBe(true);

    await reactGrab.pressArrowDown();
    await reactGrab.waitForSelectionBox();
    await reactGrab.pressArrowDown();
    await reactGrab.waitForSelectionBox();

    const afterDownVisible = await reactGrab.isSelectionBoxVisible();
    expect(afterDownVisible).toBe(true);

    const afterDownBounds = await reactGrab.getSelectionBoxBounds();
    expect(afterDownBounds).not.toBeNull();
    expect(afterDownBounds!.width).toBeGreaterThan(0);
    expect(afterDownBounds!.height).toBeGreaterThan(0);
  });
});

test.describe("Product hierarchy menu", () => {
  test.beforeEach(async ({ reactGrab }) => {
    await reactGrab.page.evaluate(() => {
      document.body.dataset.copiedTag = "";
      window.__REACT_GRAB__?.registerPlugin({
        name: "hierarchy-contract",
        hooks: {
          onBeforeCopy: (elements) => {
            document.body.dataset.copiedTag = elements[0]?.tagName ?? "";
          },
        },
      });
    });
    await reactGrab.activate();
    await reactGrab.hoverElement('[data-testid="todo-list"] li:first-child');
    await reactGrab.waitForSelectionBox();
  });

  test("menu selection drives the element copied by the engine", async ({
    reactGrab,
  }) => {
    await reactGrab.page.keyboard.press("ArrowUp");
    const parentRow = reactGrab.page.locator(
      '[data-react-grab-arrow-nav-item="ul"]',
    );
    await expect(parentRow).toBeVisible();
    await parentRow.click();
    await expect
      .poll(() =>
        reactGrab.page.evaluate(
          () => window.__REACT_GRAB__?.getState().targetElement?.tagName,
        ),
      )
      .toBe("UL");
    const bounds = await reactGrab.page
      .locator('[data-testid="todo-list"] li:first-child')
      .boundingBox();
    if (!bounds) throw new Error("Selected list is not visible");
    await reactGrab.page.mouse.click(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await expect(reactGrab.page.locator("body")).toHaveAttribute(
      "data-copied-tag",
      "UL",
    );
  });

  test("keyboard navigation continues from the menu-selected element", async ({
    reactGrab,
  }) => {
    await reactGrab.page.keyboard.press("ArrowUp");
    const parentRow = reactGrab.page.locator(
      '[data-react-grab-arrow-nav-item="ul"]',
    );
    await expect(parentRow).toBeVisible();
    await parentRow.click();
    await reactGrab.page.keyboard.press("ArrowUp");
    await expect
      .poll(() =>
        reactGrab.page.evaluate(() =>
          window.__REACT_GRAB__
            ?.getState()
            .targetElement?.getAttribute("data-testid"),
        ),
      )
      .toBe("todo-list");
    await reactGrab.page.keyboard.press("Escape");
    await expect(
      reactGrab.page.locator("[data-react-grab-arrow-nav-item]"),
    ).toHaveCount(0);
  });

  test("menu selection clears previous keyboard history", async ({
    reactGrab,
  }) => {
    await reactGrab.page.keyboard.press("ArrowUp");
    const parentRow = reactGrab.page.locator(
      '[data-react-grab-arrow-nav-item="ul"]',
    );
    await expect(parentRow).toBeVisible();
    await parentRow.click();
    await reactGrab.page.keyboard.press("ArrowDown");
    await expect
      .poll(() =>
        reactGrab.page.evaluate(
          () => window.__REACT_GRAB__?.getState().targetElement?.tagName,
        ),
      )
      .toMatch(/^(UL|LI)$/);
  });

  test("Shift shows inspect ancestors and release closes them without copying", async ({
    reactGrab,
  }) => {
    await reactGrab.page.keyboard.down("Shift");
    await expect(
      reactGrab.page.locator('[data-react-grab-arrow-nav-item="ul"]'),
    ).toBeVisible();
    await reactGrab.page.keyboard.up("Shift");
    await expect(
      reactGrab.page.locator("[data-react-grab-arrow-nav-item]"),
    ).toHaveCount(0);
    await expect(reactGrab.page.locator("body")).toHaveAttribute(
      "data-copied-tag",
      "",
    );
    await expect
      .poll(() =>
        reactGrab.page.evaluate(() => window.__REACT_GRAB__?.isActive()),
      )
      .toBe(true);
  });
});
