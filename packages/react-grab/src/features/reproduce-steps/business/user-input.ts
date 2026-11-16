// Elements whose content is what the user typed or picked (ADR-0025).
const EDITABLE_SELECTOR =
  "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='combobox'], [role='searchbox'], [role='spinbutton']";

const NATIVE_FIELD_SELECTOR = "input, textarea, select";

/** An input, textarea or select: its accessible name comes from its label. */
export const isNativeField = (element: Element): boolean =>
  element.matches(NATIVE_FIELD_SELECTOR);

/**
 * True when the element's text or content-derived accessible name could
 * contain what the user typed: it is editable, sits in an editor, or has an
 * editable element inside it. The accessible name of a button, row or cell
 * includes the live value of a field inside it (WAI-ARIA AccName, step 2E),
 * and an editor's text is what was typed.
 */
export const mayContainUserInput = (element: Element): boolean =>
  element.matches(EDITABLE_SELECTOR) ||
  (element instanceof HTMLElement && element.isContentEditable) ||
  element.querySelector(EDITABLE_SELECTOR) !== null;
