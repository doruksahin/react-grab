import type { ChangeStep, ClickPoint, ClickStep } from "../types.js";
import { stepSelectors } from "./step-selectors.js";

// The element a person means to click: the nearest control, not the icon
// or text node inside it. Container roles (row, dialog, grid) are not
// controls, so they are not listed.
const INTERACTIVE_ANCESTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "label",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex='0']",
  ...[
    "button",
    "link",
    "tab",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "option",
    "checkbox",
    "radio",
    "switch",
    "treeitem",
    "gridcell",
    "combobox",
    "textbox",
    "searchbox",
    "slider",
    "spinbutton",
  ].map((role) => `[role='${role}']`),
].join(", ");

// Inputs whose change is fully described by a click (ADR-0025): the click step
// already records it, so no change step is added.
const CLICK_ONLY_INPUT_TYPES = new Set([
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
  "file",
  "image",
  "color",
  "range",
]);

export const stepTarget = (element: Element): Element =>
  element.closest(INTERACTIVE_ANCESTOR) ?? element;

export const clickStep = (target: Element, point: ClickPoint): ClickStep => {
  const box = target.getBoundingClientRect();
  return {
    type: "click",
    selectors: stepSelectors(target),
    offsetX: Math.round(point.clientX - box.left),
    offsetY: Math.round(point.clientY - box.top),
  };
};

const isTypedField = (element: Element): boolean => {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLSelectElement) return true;
  return (
    element instanceof HTMLInputElement &&
    !CLICK_ONLY_INPUT_TYPES.has(element.type)
  );
};

/** A change step for a typed field; the value is never stored. */
export const changeStep = (element: Element): ChangeStep | undefined =>
  isTypedField(element)
    ? { type: "change", selectors: stepSelectors(element), value: "" }
    : undefined;
