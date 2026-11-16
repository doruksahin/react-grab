import {
  computeAccessibleName,
  getRole,
  isInaccessible,
} from "dom-accessibility-api";
import type { ReproduceStep } from "../types.js";
import {
  collapseWhitespace,
  parseAriaSelector,
  parseTextSelector,
} from "@react-grab/selection-text";

const ALL_ELEMENTS = "*";

// Visibility is checked last: it reads computed styles, the costly part.
const visibleMatches = (
  root: ParentNode,
  selector: string,
  matches: (element: Element) => boolean,
): Element[] => {
  try {
    return Array.from(root.querySelectorAll(selector))
      .filter(matches)
      .filter((element) => !isInaccessible(element));
  } catch {
    return [];
  }
};

// The same role and name comparison as Testing Library's queryAllByRole, on
// the library it is built on (ADR-0026).
const byAria = (selector: string, root: ParentNode): Element[] => {
  const target = parseAriaSelector(selector);
  if (!target) return [];
  return visibleMatches(
    root,
    ALL_ELEMENTS,
    (element) =>
      (!target.role || getRole(element) === target.role) &&
      collapseWhitespace(computeAccessibleName(element)) === target.name,
  );
};

// The innermost elements whose collapsed text is the stored text, which is
// how capture produced it.
const byText = (text: string, root: ParentNode): Element[] => {
  const matches = visibleMatches(
    root,
    ALL_ELEMENTS,
    (element) => collapseWhitespace(element.textContent ?? "") === text,
  );
  return matches.filter(
    (element) =>
      !matches.some((other) => other !== element && element.contains(other)),
  );
};

const candidatesFor = (selector: string, root: ParentNode): Element[] => {
  if (parseAriaSelector(selector)) return byAria(selector, root);
  const text = parseTextSelector(selector);
  if (text !== undefined) return byText(text, root);
  return visibleMatches(root, selector, () => true);
};

/** Whether an element found earlier is still on the page and visible. */
export const isStillVisible = (element: Element): boolean =>
  element.isConnected && !isInaccessible(element);

/**
 * The element a step acted on, found by its stored selectors in Recorder
 * order (ADR-0026). A selector counts only when it matches exactly one
 * visible element, so the guide never points at the wrong one.
 */
export const findStepTarget = (
  step: ReproduceStep,
  root: ParentNode,
): Element | undefined => {
  if (step.type === "navigate") return undefined;
  for (const selector of step.selectors) {
    const candidates = candidatesFor(selector, root);
    if (candidates.length === 1) return candidates[0];
  }
  return undefined;
};
