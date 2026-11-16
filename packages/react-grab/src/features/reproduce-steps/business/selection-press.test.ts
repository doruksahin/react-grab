import { describe, expect, it } from "vitest";
import { createSelectionPress } from "./selection-press.js";

const MOUSE_CLICK = 1;
const KEYBOARD_CLICK = 0;

describe("createSelectionPress", () => {
  it("marks the click of a press that started while selecting", () => {
    const press = createSelectionPress();
    press.pressStarted(true);
    expect(press.isSelectionClick(MOUSE_CLICK)).toBe(true);
  });

  it("keeps a click whose press started outside selection", () => {
    const press = createSelectionPress();
    press.pressStarted(false);
    expect(press.isSelectionClick(MOUSE_CLICK)).toBe(false);
  });

  it("consumes the press, so the next click is judged on its own", () => {
    const press = createSelectionPress();
    press.pressStarted(true);
    press.isSelectionClick(MOUSE_CLICK);
    expect(press.isSelectionClick(MOUSE_CLICK)).toBe(false);
  });

  it("never drops a keyboard click, even after a selecting press", () => {
    const press = createSelectionPress();
    press.pressStarted(true);
    expect(press.isSelectionClick(KEYBOARD_CLICK)).toBe(false);
  });

  it("forgets a cancelled press", () => {
    const press = createSelectionPress();
    press.pressStarted(true);
    press.pressCancelled();
    expect(press.isSelectionClick(MOUSE_CLICK)).toBe(false);
  });
});
