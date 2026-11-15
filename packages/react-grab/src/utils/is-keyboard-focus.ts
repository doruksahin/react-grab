/**
 * True when focus reached the event's target by keyboard (`:focus-visible`),
 * false for pointer or script focus. Tooltips and highlights follow keyboard
 * focus only (WAI-ARIA tooltip pattern).
 */
export const isKeyboardFocus = (event: FocusEvent): boolean => {
  const target = event.currentTarget;
  return target instanceof Element && target.matches(":focus-visible");
};
