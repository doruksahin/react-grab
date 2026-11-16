import { describe, expect, it } from "vitest";
import { describeStep, stepParts } from "./describe-step.js";

describe("stepParts", () => {
  it("marks a page, a readable name and a bare selector apart", () => {
    expect(stepParts({ type: "navigate", url: "https://a.example/x" })).toEqual(
      { verb: "Open", target: "/x", targetKind: "page" },
    );
    expect(
      stepParts({
        type: "click",
        selectors: ['aria/Billing[role="tab"]'],
        offsetX: 1,
        offsetY: 1,
      }),
    ).toEqual({
      verb: "Click",
      target: "Billing",
      targetKind: "name",
      role: "tab",
      destination: undefined,
      details: "tab",
    });
    expect(
      stepParts({ type: "change", selectors: ["#coupon"], value: "" }),
    ).toEqual({
      verb: "Change",
      target: "#coupon",
      targetKind: "selector",
      valueNotSaved: true,
      details: "value not saved",
    });
  });
});

describe("describeStep", () => {
  it("names the page a navigate opens", () => {
    expect(
      describeStep({
        type: "navigate",
        url: "https://app.example.com/settings?tab=1",
      }),
    ).toBe("Open /settings");
  });

  it("names a click by its accessible name and role", () => {
    expect(
      describeStep({
        type: "click",
        selectors: ['aria/Billing[role="tab"]', "#billing", "text/Billing"],
        offsetX: 1,
        offsetY: 1,
      }),
    ).toBe("Click “Billing” (tab)");
  });

  it("falls back to the text, then the CSS selector", () => {
    expect(
      describeStep({
        type: "click",
        selectors: ["#save", "text/Save draft"],
        offsetX: 1,
        offsetY: 1,
      }),
    ).toBe("Click “Save draft”");
    expect(
      describeStep({
        type: "click",
        selectors: ["ul > li:nth-child(2)"],
        offsetX: 1,
        offsetY: 1,
      }),
    ).toBe("Click “ul > li:nth-child(2)”");
  });

  it("says where a click led", () => {
    expect(
      describeStep({
        type: "click",
        selectors: ["aria/Billing"],
        offsetX: 1,
        offsetY: 1,
        assertedEvents: [
          {
            type: "navigation",
            url: "https://app.example.com/settings/billing",
          },
        ],
      }),
    ).toBe("Click “Billing” → /settings/billing");
  });

  it("says a changed field's value was not saved", () => {
    expect(
      describeStep({
        type: "change",
        selectors: ['aria/Coupon[role="textbox"]', "#coupon"],
        value: "",
      }),
    ).toBe("Change “Coupon” (textbox, value not saved)");
  });

  const click = (selectors: string[]) => ({
    type: "click" as const,
    selectors,
    offsetX: 1,
    offsetY: 1,
  });

  it("names an aria selector without a role", () => {
    expect(describeStep(click(["aria/Save"]))).toBe("Click “Save”");
  });

  it("keeps names with parentheses or arrows whole", () => {
    expect(describeStep(click(['aria/Pay (EUR) → next[role="button"]']))).toBe(
      "Click “Pay (EUR) → next” (button)",
    );
  });

  it("falls through an empty aria name to the text", () => {
    expect(describeStep(click(["aria/", "text/Save"]))).toBe("Click “Save”");
  });

  it("uses a CSS selector, never an aria or text one, as the last resort", () => {
    expect(describeStep(click(["aria/[broken", "#save"]))).toBe(
      "Click “#save”",
    );
    expect(describeStep(click([]))).toBe("Click “element”");
  });

  it("describes a change without a role", () => {
    expect(
      describeStep({ type: "change", selectors: ["#coupon"], value: "" }),
    ).toBe("Change “#coupon” (value not saved)");
  });

  it("keeps a hash route", () => {
    expect(
      describeStep({
        type: "navigate",
        url: "https://app.example.com/#/settings",
      }),
    ).toBe("Open /#/settings");
  });

  it("leaves an unparseable URL as it is", () => {
    expect(describeStep({ type: "navigate", url: "not a url" })).toBe(
      "Open not a url",
    );
  });
});
