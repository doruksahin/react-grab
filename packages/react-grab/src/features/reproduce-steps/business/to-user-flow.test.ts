import { parse } from "@puppeteer/replay";
import { describe, expect, it } from "vitest";
import { toUserFlow, userFlowFileName } from "./to-user-flow.js";

const steps = [
  { type: "navigate" as const, url: "https://app.example.com/settings" },
  {
    type: "click" as const,
    selectors: ['aria/Billing[role="tab"]'],
    offsetX: 2,
    offsetY: 3,
  },
];

const item = {
  id: "c-1",
  elementName: "button",
  componentName: "BillingTab",
  commentText: "Plan price is cut off",
  steps,
};

describe("toUserFlow", () => {
  it("titles the flow with the comment", () => {
    expect(toUserFlow(item)).toEqual({ title: "Plan price is cut off", steps });
  });

  it("falls back to the component, then the element name", () => {
    expect(toUserFlow({ ...item, commentText: undefined })?.title).toBe(
      "BillingTab",
    );
    expect(
      toUserFlow({ ...item, commentText: "", componentName: undefined })?.title,
    ).toBe("button");
  });

  it("is undefined without steps", () => {
    expect(toUserFlow({ ...item, steps: undefined })).toBeUndefined();
    expect(toUserFlow({ ...item, steps: [] })).toBeUndefined();
  });

  it("is a flow Chrome DevTools Recorder accepts", () => {
    expect(() => parse(toUserFlow(item))).not.toThrow();
  });

  it("names the file after the selection", () => {
    expect(userFlowFileName(item)).toBe("react-grab-steps-c-1.json");
  });
});
