import { parseWebUrl } from "../../../utils/parse-web-url.js";

/**
 * A page is its origin and path (ADR-0024): query and fragment changes are
 * state, not another page. Undefined for anything that is not a web page.
 */
export const pageKey = (url: string): string | undefined => {
  const page = parseWebUrl(url);
  return page ? `${page.origin}${page.pathname}` : undefined;
};

export const originOf = (url: string): string | undefined =>
  parseWebUrl(url)?.origin;
