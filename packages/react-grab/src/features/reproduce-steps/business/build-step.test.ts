import { afterEach, describe, expect, it } from "vitest";
import { changeStep, clickStep, stepTarget } from "./build-step.js";

const render = (html: string): HTMLElement => {
  document.body.innerHTML = html;
  const target = document.querySelector<HTMLElement>("[data-target]");
  if (!target) throw new Error("fixture needs a [data-target] element");
  return target;
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("stepTarget", () => {
  it("takes the control around an icon that was clicked", () => {
    const icon = render(
      '<button id="save"><svg><path data-target></path></svg>Save</button>',
    );
    expect(stepTarget(icon)).toBe(document.getElementById("save"));
  });

  it("does not take a container role as the control", () => {
    const cell = render(
      '<div role="row" tabindex="-1"><span data-target>1</span></div>',
    );
    expect(stepTarget(cell)).toBe(cell);
  });

  it("keeps an element that has no control around it", () => {
    const cell = render("<table><tr><td data-target>1</td></tr></table>");
    expect(stepTarget(cell)).toBe(cell);
  });
});

describe("clickStep", () => {
  it("records the point relative to the element's box", () => {
    const button = render("<button data-target>Go</button>");
    button.getBoundingClientRect = () => new DOMRect(100, 50, 80, 20);
    expect(clickStep(button, { clientX: 112.4, clientY: 58.6 })).toEqual({
      type: "click",
      selectors: expect.arrayContaining(['aria/Go[role="button"]']),
      offsetX: 12,
      offsetY: 9,
    });
  });
});

describe("changeStep", () => {
  it("records a typed field without its value", () => {
    const input = render('<input data-target aria-label="Coupon">');
    input.setAttribute("value", "SECRET-CODE");
    const step = changeStep(input);
    expect(step).toMatchObject({ type: "change", value: "" });
    expect(JSON.stringify(step)).not.toContain("SECRET-CODE");
  });

  it("records textarea and select", () => {
    expect(
      changeStep(render("<textarea data-target></textarea>")),
    ).toBeDefined();
    expect(
      changeStep(render("<select data-target><option>a</option></select>")),
    ).toBeDefined();
  });

  it("leaves checkboxes and radios to their click step", () => {
    expect(
      changeStep(render('<input type="checkbox" data-target>')),
    ).toBeUndefined();
    expect(
      changeStep(render('<input type="radio" data-target>')),
    ).toBeUndefined();
  });

  it("ignores elements that are not fields", () => {
    expect(changeStep(render("<div data-target></div>"))).toBeUndefined();
  });
});
