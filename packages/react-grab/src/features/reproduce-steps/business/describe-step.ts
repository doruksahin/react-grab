import type { ChangeStep, ClickStep, ReproduceStep } from "../types.js";
import {
  type AriaTarget,
  isCssSelector,
  parseAriaSelector,
  parseTextSelector,
} from "./recorder-selector.js";

// A hash router keeps its route in the fragment (`/#/settings`).
const HASH_ROUTE_PREFIX = "#/";

/** The page part of a URL: its path, plus a hash route. Query is left out. */
const pageOf = (url: string): string => {
  if (!URL.canParse(url)) return url;
  const { pathname, hash } = new URL(url);
  return hash.startsWith(HASH_ROUTE_PREFIX) ? `${pathname}${hash}` : pathname;
};

const firstDefined = <Value>(
  selectors: string[],
  parse: (selector: string) => Value | undefined,
): Value | undefined => {
  for (const selector of selectors) {
    const value = parse(selector);
    if (value !== undefined) return value;
  }
  return undefined;
};

/** The best human label among a step's own selectors: ARIA, then text, then CSS. */
const targetOf = (step: ClickStep | ChangeStep): AriaTarget => {
  const aria = firstDefined(step.selectors, parseAriaSelector);
  if (aria) return aria;
  const text = firstDefined(step.selectors, parseTextSelector);
  if (text) return { name: text };
  return { name: step.selectors.find(isCssSelector) ?? "element" };
};

/**
 * One readable, plain-text sentence for a step (ADR-0025, phase 3). Shared
 * by the sidebar's step list, the guide and the Jira description, which
 * escapes it.
 */
export const describeStep = (step: ReproduceStep): string => {
  if (step.type === "navigate") return `Open ${pageOf(step.url)}`;

  const { name, role } = targetOf(step);
  if (step.type === "change") {
    const detail = role ? `${role}, value not saved` : "value not saved";
    return `Change “${name}” (${detail})`;
  }

  const roleText = role ? ` (${role})` : "";
  const navigation = step.assertedEvents?.find(
    (event) => event.type === "navigation",
  );
  const destination = navigation ? ` → ${pageOf(navigation.url)}` : "";
  return `Click “${name}”${roleText}${destination}`;
};
