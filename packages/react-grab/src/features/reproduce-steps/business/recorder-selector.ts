/*
 * The selector syntax of a Recorder step (ADR-0025): Puppeteer's `aria/` and
 * `text/` prefixes, and plain CSS otherwise. Capture writes it, the step
 * sentence and the guide read it, all through this module.
 */

const ARIA_PREFIX = "aria/";
const TEXT_PREFIX = "text/";
// Characters that end or quote parts of an ARIA selector; names never hold them.
const ARIA_SELECTOR_SYNTAX = /[[\]"]/;
const ARIA_SELECTOR = /^aria\/([^[\]"]+)(?:\[role="([^"]+)"\])?$/;

export interface AriaTarget {
  name: string;
  role?: string;
}

export const collapseWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

/** An ARIA selector, or undefined when the name cannot be written in one. */
export const toAriaSelector = ({
  name,
  role,
}: AriaTarget): string | undefined => {
  if (!name || ARIA_SELECTOR_SYNTAX.test(name)) return undefined;
  return role
    ? `${ARIA_PREFIX}${name}[role="${role}"]`
    : `${ARIA_PREFIX}${name}`;
};

export const toTextSelector = (text: string): string => `${TEXT_PREFIX}${text}`;

export const parseAriaSelector = (selector: string): AriaTarget | undefined => {
  const parts = selector.match(ARIA_SELECTOR);
  if (!parts?.[1]) return undefined;
  return parts[2] ? { name: parts[1], role: parts[2] } : { name: parts[1] };
};

export const parseTextSelector = (selector: string): string | undefined =>
  selector.startsWith(TEXT_PREFIX) && selector.length > TEXT_PREFIX.length
    ? selector.slice(TEXT_PREFIX.length)
    : undefined;

export const isCssSelector = (selector: string): boolean =>
  !selector.startsWith(ARIA_PREFIX) && !selector.startsWith(TEXT_PREFIX);
