import type { SelectionLocation } from "./types.js";

/**
 * Goes to the page a selection was made on. Only an other-page location has
 * a URL, and it always has the current origin (ADR-0024).
 */
export const openSelectionPage = (
  location: Extract<SelectionLocation, { kind: "other-page" }>,
): void => {
  window.location.assign(location.url);
};
