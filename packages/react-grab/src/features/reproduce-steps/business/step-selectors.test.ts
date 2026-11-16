import { afterEach, describe, expect, it } from "vitest";
import { stepSelectors } from "./step-selectors.js";

const render = (html: string): Element => {
  document.body.innerHTML = html;
  const target = document.querySelector("[data-target]");
  if (!target) throw new Error("fixture needs a [data-target] element");
  return target;
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("stepSelectors", () => {
  it("lists aria, CSS and text alternatives in Recorder order", () => {
    const target = render(
      '<div><button data-target data-testid="buy">Buy now</button></div>',
    );
    expect(stepSelectors(target)).toEqual([
      'aria/Buy now[role="button"]',
      '[data-testid="buy"]',
      "text/Buy now",
    ]);
  });

  it("uses the accessible name from a label", () => {
    const target = render(
      '<label for="coupon">Coupon</label><input id="coupon" data-target>',
    );
    expect(stepSelectors(target)[0]).toBe('aria/Coupon[role="textbox"]');
  });

  it("leaves out aria when the element has no name", () => {
    const target = render('<div><span data-target class="dot"></span></div>');
    expect(stepSelectors(target).some((s) => s.startsWith("aria/"))).toBe(
      false,
    );
  });

  it("leaves out aria when the name would break the selector syntax", () => {
    const target = render("<button data-target>Save [draft]</button>");
    expect(stepSelectors(target).some((s) => s.startsWith("aria/"))).toBe(
      false,
    );
  });

  it("leaves out text that is long", () => {
    const target = render(`<p data-target>${"word ".repeat(30)}</p>`);
    expect(stepSelectors(target).some((s) => s.startsWith("text/"))).toBe(
      false,
    );
  });

  it("collapses whitespace in text", () => {
    const target = render("<a data-target href='#'>  Billing\n  tab </a>");
    expect(stepSelectors(target)).toContain("text/Billing tab");
  });

  it("always has a CSS selector that finds the element", () => {
    const target = render("<ul><li>a</li><li data-target></li></ul>");
    const css = stepSelectors(target).find(
      (selector) =>
        !selector.startsWith("aria/") && !selector.startsWith("text/"),
    );
    expect(css && document.querySelector(css)).toBe(target);
  });
});

describe("stepSelectors never carries what the user typed", () => {
  const SECRET = "LIVE-SECRET";

  const typeInto = (selector: string) => {
    const field = document.querySelector(selector);
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLTextAreaElement
    ) {
      field.value = SECRET;
    }
    if (field instanceof HTMLSelectElement) field.value = SECRET;
    if (field instanceof HTMLElement && field.isContentEditable) {
      field.textContent = SECRET;
    }
  };

  it.each([
    ['<div role="gridcell" data-target>Qty <input></div>', "input"],
    ['<div role="option" data-target>Rename <input></div>', "input"],
    ['<div role="row" data-target><textarea></textarea></div>', "textarea"],
    [
      `<div role="tab" data-target>Size <select><option>S</option><option>${SECRET}</option></select></div>`,
      "select",
    ],
    [
      '<div role="button" data-target><span contenteditable="true"></span></div>',
      "[contenteditable]",
    ],
    ['<div contenteditable="true" data-target></div>', "[contenteditable]"],
    ["<label data-target>Name <input></label>", "input"],
  ])("%s", (html, field) => {
    const target = render(html);
    typeInto(field);
    expect(stepSelectors(target).join(" ")).not.toContain(SECRET);
  });

  it("leaves out a textarea's default text", () => {
    const target = render(`<textarea data-target>${SECRET}</textarea>`);
    expect(stepSelectors(target).join(" ")).not.toContain(SECRET);
  });

  it("keeps a field's name from its label", () => {
    const target = render(
      '<label for="qty">Quantity</label><input id="qty" data-target>',
    );
    typeInto("input");
    expect(stepSelectors(target)[0]).toBe('aria/Quantity[role="textbox"]');
  });
});
