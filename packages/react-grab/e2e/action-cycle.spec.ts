import { test, expect } from "./fixtures.js";
import { ACTION_CYCLE_IDLE_TRIGGER_MS } from "../src/constants.js";

test.describe("Product action cycle", () => {
  test.beforeEach(async ({ reactGrab }) => {
    await reactGrab.page.evaluate(() => {
      const api = window.__REACT_GRAB__;
      if (!api) throw new Error("React Grab API is unavailable");
      for (const name of [
        "copy",
        "comment",
        "copy-html",
        "copy-styles",
        "open",
      ])
        api.unregisterPlugin(name);
      document.body.dataset.actionCalls = "[]";
      api.registerPlugin({
        name: "cycle-contract",
        actions: ["First", "Second"].map((label) => ({
          id: label.toLowerCase(),
          label,
          shortcut: "C",
          onAction: (context) => {
            const calls = JSON.parse(document.body.dataset.actionCalls ?? "[]");
            calls.push({ label, text: context.element.textContent });
            document.body.dataset.actionCalls = JSON.stringify(calls);
          },
        })),
      });
    });
    await reactGrab.activate();
    await reactGrab.hoverElement("[data-testid=main-title]");
    await reactGrab.waitForSelectionBox();
  });

  test("executes the cycled action once with the selected element", async ({
    reactGrab,
  }) => {
    const expectedText = await reactGrab.page
      .getByTestId("main-title")
      .textContent();
    await reactGrab.page.keyboard.press("c");
    await reactGrab.page.keyboard.press("c");
    await expect(
      reactGrab.page.locator('[data-react-grab-action-cycle-item="second"]'),
    ).toBeVisible();
    await expect
      .poll(() =>
        reactGrab.page.evaluate(() => document.body.dataset.actionCalls),
      )
      .toBe(JSON.stringify([{ label: "Second", text: expectedText }]));
    await reactGrab.page.waitForTimeout(ACTION_CYCLE_IDLE_TRIGGER_MS);
    await expect(reactGrab.page.locator("body")).toHaveAttribute(
      "data-action-calls",
      JSON.stringify([{ label: "Second", text: expectedText }]),
    );
  });

  test("Escape cancels the pending action", async ({ reactGrab }) => {
    await reactGrab.page.keyboard.press("c");
    await expect(
      reactGrab.page.locator('[data-react-grab-action-cycle-item="first"]'),
    ).toBeVisible();
    await reactGrab.page.keyboard.press("Escape");
    await reactGrab.page.waitForTimeout(ACTION_CYCLE_IDLE_TRIGGER_MS);
    await expect(reactGrab.page.locator("body")).toHaveAttribute(
      "data-action-calls",
      "[]",
    );
    await expect
      .poll(() =>
        reactGrab.page.evaluate(() => window.__REACT_GRAB__?.isActive()),
      )
      .toBe(false);
  });

  test("unregistering a plugin cancels its pending action", async ({
    reactGrab,
  }) => {
    await reactGrab.page.keyboard.press("c");
    await expect(
      reactGrab.page.locator('[data-react-grab-action-cycle-item="first"]'),
    ).toBeVisible();
    await reactGrab.page.evaluate(() =>
      window.__REACT_GRAB__?.unregisterPlugin("cycle-contract"),
    );
    await reactGrab.page.waitForTimeout(ACTION_CYCLE_IDLE_TRIGGER_MS);
    await expect(reactGrab.page.locator("body")).toHaveAttribute(
      "data-action-calls",
      "[]",
    );
  });

  test("dispose clears the pending action", async ({ reactGrab }) => {
    await reactGrab.page.keyboard.press("c");
    await expect(
      reactGrab.page.locator('[data-react-grab-action-cycle-item="first"]'),
    ).toBeVisible();
    await reactGrab.page.evaluate(() => window.__REACT_GRAB__?.dispose());
    await reactGrab.page.waitForTimeout(ACTION_CYCLE_IDLE_TRIGGER_MS);
    await expect(reactGrab.page.locator("body")).toHaveAttribute(
      "data-action-calls",
      "[]",
    );
  });

  test("typing in an editor input does not run an action", async ({
    reactGrab,
  }) => {
    await reactGrab.page.evaluate(() => {
      const input = document.createElement("input");
      input.id = "action-cycle-input";
      input.setAttribute("data-react-grab-ignore-events", "");
      document.body.append(input);
      input.focus();
    });
    await reactGrab.page.keyboard.press("c");
    await reactGrab.page.waitForTimeout(ACTION_CYCLE_IDLE_TRIGGER_MS);
    await expect(reactGrab.page.locator("#action-cycle-input")).toHaveValue(
      "c",
    );
    await expect(reactGrab.page.locator("body")).toHaveAttribute(
      "data-action-calls",
      "[]",
    );
  });
});
