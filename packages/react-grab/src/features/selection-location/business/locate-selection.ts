import type { LocateSelectionInput, SelectionLocation } from "../types.js";

const WEB_PROTOCOLS = new Set(["http:", "https:"]);

const parseWebUrl = (value: string | undefined): URL | undefined => {
  if (!value || !URL.canParse(value)) return undefined;
  const url = new URL(value);
  return WEB_PROTOCOLS.has(url.protocol) ? url : undefined;
};

/**
 * Where a selection is relative to the current page (ADR-0024). Only http(s)
 * pages count. Same site means the same origin; same page means the same
 * origin and path — query and fragment usually hold state, not a page.
 */
export const locateSelection = ({
  pageUrl,
  currentUrl,
  isOnPage,
}: LocateSelectionInput): SelectionLocation => {
  if (isOnPage) return ON_PAGE;

  const madeOn = parseWebUrl(pageUrl);
  const current = parseWebUrl(currentUrl);
  if (!madeOn || !current) return { kind: "unknown" };

  if (madeOn.origin !== current.origin) {
    return { kind: "other-site", host: madeOn.host };
  }
  if (madeOn.pathname !== current.pathname) {
    return { kind: "other-page", url: madeOn.href, path: madeOn.pathname };
  }
  return { kind: "gone" };
};

export const ON_PAGE: SelectionLocation = { kind: "on-page" };
