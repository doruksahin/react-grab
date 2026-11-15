import { describe, expect, it } from "vitest";
import { TOOLBAR_STATE_FIXTURE } from "../test-fixtures.js";
import { isSameToolbarState } from "./is-same-toolbar-state.js";

describe("isSameToolbarState", () => {
  it("treats equal field values as the same state", () => {
    expect(
      isSameToolbarState(TOOLBAR_STATE_FIXTURE, { ...TOOLBAR_STATE_FIXTURE }),
    ).toBe(true);
  });

  it("detects a change in any field, including optional ones", () => {
    expect(
      isSameToolbarState(TOOLBAR_STATE_FIXTURE, {
        ...TOOLBAR_STATE_FIXTURE,
        selectionsRevealed: true,
      }),
    ).toBe(false);
    expect(
      isSameToolbarState(TOOLBAR_STATE_FIXTURE, {
        ...TOOLBAR_STATE_FIXTURE,
        defaultAction: "copy",
      }),
    ).toBe(false);
  });
});
