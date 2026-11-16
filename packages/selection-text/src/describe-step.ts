import {
  isCssSelector,
  parseAriaSelector,
  parseTextSelector,
} from "./recorder-selector.js";
import type {
  StepFields,
  StepParts,
  StepTargetKind,
  TargetStepFields,
} from "./types.js";

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

interface StepTarget {
  name: string;
  role?: string;
  kind: StepTargetKind;
}

/** The best human label among a step's own selectors: ARIA, then text, then CSS. */
const targetOf = (step: TargetStepFields): StepTarget => {
  const aria = firstDefined(step.selectors, parseAriaSelector);
  if (aria) return { ...aria, kind: "name" };
  const text = firstDefined(step.selectors, parseTextSelector);
  if (text) return { name: text, kind: "name" };
  const css = step.selectors.find(isCssSelector);
  return css
    ? { name: css, kind: "selector" }
    : { name: FALLBACK_TARGET, kind: "name" };
};

/** The parts of a step's sentence (ADR-0025), for renderers that style them. */
export const describeStepParts = (step: StepFields): StepParts => {
  if (step.type === "navigate") {
    return { verb: "Open", target: pageOf(step.url), targetKind: "page" };
  }

  const { name, role, kind } = targetOf(step);
  if (step.type === "change") {
    return {
      verb: "Change",
      target: name,
      targetKind: kind,
      detail: role ? `(${role}, value not saved)` : "(value not saved)",
    };
  }

  const navigation = step.assertedEvents?.find(
    (event) => event.type === "navigation",
  );
  return {
    verb: "Click",
    target: name,
    targetKind: kind,
    detail: role ? `(${role})` : undefined,
    destination: navigation ? pageOf(navigation.url) : undefined,
  };
};

/**
 * One readable, plain-text sentence for a step (ADR-0025, phase 3). Shared
 * by the sidebar's step list, the guide and the Jira description.
 */
export const describeStep = (step: StepFields): string => {
  const { verb, target, targetKind, detail, destination } =
    describeStepParts(step);
  const targetText = targetKind === "page" ? target : `“${target}”`;
  const detailText = detail ? ` ${detail}` : "";
  const destinationText = destination ? ` → ${destination}` : "";
  return `${verb} ${targetText}${detailText}${destinationText}`;
};
