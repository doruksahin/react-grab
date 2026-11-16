import type { ChangeStep, ClickStep, ReproduceStep } from "../types.js";

const ARIA_PREFIX = "aria/";
const TEXT_PREFIX = "text/";
// `aria/<name>` with an optional `[role="<role>"]` (Puppeteer ARIA selector).
// A name never holds `[`, `]` or `"`: capture leaves such names out.
const ARIA_SELECTOR = /^aria\/([^[\]"]+)(?:\[role="([^"]+)"\])?$/;
// A hash router keeps its route in the fragment (`/#/settings`).
const HASH_ROUTE_PREFIX = "#/";

interface StepTarget {
  label: string;
  role?: string;
}

/** The page part of a URL: its path, plus a hash route. Query is left out. */
const pageOf = (url: string): string => {
  if (!URL.canParse(url)) return url;
  const { pathname, hash } = new URL(url);
  return hash.startsWith(HASH_ROUTE_PREFIX) ? `${pathname}${hash}` : pathname;
};

const isCssSelector = (selector: string): boolean =>
  !selector.startsWith(ARIA_PREFIX) && !selector.startsWith(TEXT_PREFIX);

/** The best human label among a step's own selectors: ARIA, then text, then CSS. */
const targetOf = (step: ClickStep | ChangeStep): StepTarget => {
  const aria = step.selectors.find((selector) =>
    selector.startsWith(ARIA_PREFIX),
  );
  const ariaParts = aria?.match(ARIA_SELECTOR);
  if (ariaParts?.[1]) return { label: ariaParts[1], role: ariaParts[2] };

  const text = step.selectors.find((selector) =>
    selector.startsWith(TEXT_PREFIX),
  );
  if (text && text.length > TEXT_PREFIX.length) {
    return { label: text.slice(TEXT_PREFIX.length) };
  }
  return { label: step.selectors.find(isCssSelector) ?? "element" };
};

/**
 * One readable, plain-text sentence for a step (ADR-0025, phase 3). Shared
 * by the sidebar's step list and the Jira description, which escapes it.
 */
export const describeStep = (step: ReproduceStep): string => {
  if (step.type === "navigate") return `Open ${pageOf(step.url)}`;

  const { label, role } = targetOf(step);
  if (step.type === "change") {
    const detail = role ? `${role}, value not saved` : "value not saved";
    return `Change “${label}” (${detail})`;
  }

  const roleText = role ? ` (${role})` : "";
  const navigation = step.assertedEvents?.find(
    (event) => event.type === "navigation",
  );
  const destination = navigation ? ` → ${pageOf(navigation.url)}` : "";
  return `Click “${label}”${roleText}${destination}`;
};
