import {
  isCssSelector,
  parseAriaSelector,
  parseTextSelector,
} from "./recorder-selector.js";
import type { StepFields, StepParts, TargetStepFields } from "./types.js";

// A hash router keeps its route in the fragment (`/#/settings`).
const HASH_ROUTE_PREFIX = "#/";
const FALLBACK_TARGET = "element";

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

/** The best target among a step's own selectors: ARIA, then text, then CSS. */
const targetOf = (
  step: TargetStepFields,
): Pick<StepParts, "target" | "targetKind" | "role"> => {
  const aria = firstDefined(step.selectors, parseAriaSelector);
  if (aria) return { target: aria.name, targetKind: "name", role: aria.role };
  const text = firstDefined(step.selectors, parseTextSelector);
  if (text) return { target: text, targetKind: "name" };
  const css = step.selectors.find(isCssSelector);
  return css
    ? { target: css, targetKind: "selector" }
    : { target: FALLBACK_TARGET, targetKind: "name" };
};

const partsOf = (step: StepFields): StepParts => {
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
export const stepParts = (step: StepFields): StepParts =>
  withDetails(partsOf(step));

/**
 * One readable, plain-text sentence for a step (ADR-0025, phase 3). Shared
 * by the overlay's guide and step lists, and by the sync server's Jira
 * description (SPEC-021).
 */
export const describeStep = (step: StepFields): string => {
  const parts = stepParts(step);
  if (parts.targetKind === "page") return `${parts.verb} ${parts.target}`;

  const detailText = parts.details ? ` (${parts.details})` : "";
  const destination = parts.destination ? ` → ${parts.destination}` : "";
  return `${parts.verb} “${parts.target}”${detailText}${destination}`;
};
