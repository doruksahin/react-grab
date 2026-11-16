import { computeAccessibleName, getRole } from "dom-accessibility-api";
import { createElementSelector } from "../../../utils/create-element-selector.js";
import {
  STEP_ACCESSIBLE_NAME_MAX_LENGTH_CHARS,
  STEP_TEXT_MAX_LENGTH_CHARS,
} from "../../../constants.js";
import { STEP_SELECTOR_MAX_LENGTH_CHARS } from "../limits.js";
import { isNativeField, mayContainUserInput } from "./user-input.js";
import {
  collapseWhitespace,
  toAriaSelector,
  toTextSelector,
} from "./recorder-selector.js";

// A field's name comes from its label, so it is safe; any other element's
// name may include the value of a field inside it.
const ariaSelector = (element: Element): string | undefined => {
  if (!isNativeField(element) && mayContainUserInput(element)) {
    return undefined;
  }
  const name = collapseWhitespace(computeAccessibleName(element));
  if (name.length > STEP_ACCESSIBLE_NAME_MAX_LENGTH_CHARS) return undefined;
  return toAriaSelector({ name, role: getRole(element) ?? undefined });
};

const textSelector = (element: Element): string | undefined => {
  if (mayContainUserInput(element)) return undefined;
  const text = collapseWhitespace(element.textContent ?? "");
  if (!text || text.length > STEP_TEXT_MAX_LENGTH_CHARS) return undefined;
  return toTextSelector(text);
};

/**
 * Alternative selectors for one step, in the order the Chrome DevTools
 * Recorder writes them: ARIA (accessible name and role), CSS, text
 * (ADR-0025). Each fits the server's selector length limit. No selector
 * carries what the user typed: names and text are left out wherever a field's
 * value could be part of them.
 */
export const stepSelectors = (element: Element): string[] =>
  [
    ariaSelector(element),
    createElementSelector(element),
    textSelector(element),
  ].filter(
    (selector): selector is string =>
      selector !== undefined &&
      selector.length <= STEP_SELECTOR_MAX_LENGTH_CHARS,
  );
