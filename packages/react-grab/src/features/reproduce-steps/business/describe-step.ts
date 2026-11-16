import type { ChangeStep, ClickStep, ReproduceStep } from "../types.js";
import {
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

/**
 * What a step's target is: a page path, a name a person reads on screen
 * (ARIA or text), or only a CSS selector.
 */
export type StepTargetKind = "page" | "name" | "selector";

/** A step split into the parts a view styles separately. */
export interface StepParts {
  verb: "Open" | "Click" | "Change";
  target: string;
  targetKind: StepTargetKind;
  role?: string;
  /** The page a click led to. */
  destination?: string;
  /** A change step's value is never stored. */
  valueNotSaved?: boolean;
  /** Role and notes, as the sentence shows them in parentheses. */
  details?: string;
}

/** The best target among a step's own selectors: ARIA, then text, then CSS. */
const targetOf = (
  step: ClickStep | ChangeStep,
): Pick<StepParts, "target" | "targetKind" | "role"> => {
  const aria = firstDefined(step.selectors, parseAriaSelector);
  if (aria) return { target: aria.name, targetKind: "name", role: aria.role };
  const text = firstDefined(step.selectors, parseTextSelector);
  if (text) return { target: text, targetKind: "name" };
  return {
    target: step.selectors.find(isCssSelector) ?? "element",
    targetKind: "selector",
  };
};

const partsOf = (step: ReproduceStep): StepParts => {
  if (step.type === "navigate") {
    return { verb: "Open", target: pageOf(step.url), targetKind: "page" };
  }
  if (step.type === "change") {
    return { verb: "Change", ...targetOf(step), valueNotSaved: true };
  }
  const navigation = step.assertedEvents?.find(
    (event) => event.type === "navigation",
  );
  return {
    verb: "Click",
    ...targetOf(step),
    destination: navigation ? pageOf(navigation.url) : undefined,
  };
};

const withDetails = (parts: StepParts): StepParts => {
  const details = [
    parts.role,
    parts.valueNotSaved ? "value not saved" : undefined,
  ].filter(Boolean);
  return details.length > 0 ? { ...parts, details: details.join(", ") } : parts;
};

/** One step as parts: verb, target and what kind of target (ADR-0025). */
export const stepParts = (step: ReproduceStep): StepParts =>
  withDetails(partsOf(step));

/**
 * One readable, plain-text sentence for a step (ADR-0025, phase 3). Shared
 * by the guide and the Jira description, which escapes it.
 */
export const describeStep = (step: ReproduceStep): string => {
  const parts = stepParts(step);
  if (parts.targetKind === "page") return `${parts.verb} ${parts.target}`;

  const detailText = parts.details ? ` (${parts.details})` : "";
  const destination = parts.destination ? ` → ${parts.destination}` : "";
  return `${parts.verb} “${parts.target}”${detailText}${destination}`;
};
