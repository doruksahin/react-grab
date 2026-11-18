import { describe, expect, it } from "vitest";
import type { CapturedStep } from "../types.js";
import { stepsOnCurrentPage } from "./steps-on-current-page.js";

const DASHBOARD = "https://app.example.com/dashboard";
const SETTINGS = "https://app.example.com/settings";

const click = (selector: string, pageUrl: string): CapturedStep => ({
  step: { type: "click", selectors: [selector], offsetX: 0, offsetY: 0 },
  pageUrl,
});

describe("stepsOnCurrentPage", () => {
  it("keeps every step when all were taken on the current page", () => {
    const captured = [click("#a", SETTINGS), click("#b", SETTINGS)];
    expect(stepsOnCurrentPage(captured, SETTINGS)).toEqual(captured);
  });

  it("leaves out the steps before the current page was last entered", () => {
    const onSettings = click("#billing-tab", SETTINGS);
    const captured = [
      click("#new-ad", DASHBOARD),
      click("#settings-link", DASHBOARD),
      onSettings,
    ];
    expect(stepsOnCurrentPage(captured, SETTINGS)).toEqual([onSettings]);
  });

  it("starts at the last entry when the page was entered twice", () => {
    const afterReturn = click("#save", SETTINGS);
    const captured = [
      click("#first-visit", SETTINGS),
      click("#dashboard-link", SETTINGS),
      click("#settings-link", DASHBOARD),
      afterReturn,
    ];
    expect(stepsOnCurrentPage(captured, SETTINGS)).toEqual([afterReturn]);
  });

  it("is empty when no step was taken on the current page", () => {
    const captured = [click("#settings-link", DASHBOARD)];
    expect(stepsOnCurrentPage(captured, SETTINGS)).toEqual([]);
  });

  it("treats a query or fragment change as the same page", () => {
    const captured = [
      click("#search", SETTINGS),
      click("#result", `${SETTINGS}?q=shoes#top`),
    ];
    expect(stepsOnCurrentPage(captured, `${SETTINGS}?q=shoes`)).toEqual(
      captured,
    );
  });
});
