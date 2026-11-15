import { afterEach, describe, expect, it } from "vitest";
import { isKeyboardFocus } from "./is-keyboard-focus.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isKeyboardFocus", () => {
  it("is false when the event has no element target", () => {
    expect(isKeyboardFocus(new FocusEvent("focus"))).toBe(false);
  });

  it("is false for an element that does not match :focus-visible", () => {
    const button = document.createElement("button");
    document.body.append(button);
    let result: boolean | undefined;
    button.addEventListener("focus", (event) => {
      if (event instanceof FocusEvent) result = isKeyboardFocus(event);
    });
    button.dispatchEvent(new FocusEvent("focus"));
    expect(result).toBe(false);
  });
});
