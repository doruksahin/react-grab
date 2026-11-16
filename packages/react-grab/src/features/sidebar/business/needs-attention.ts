import type { SelectionLocation } from "../../selection-location/types.js";

export interface AttentionFacts {
  flagged: boolean;
  location: SelectionLocation["kind"];
}

const NOT_HERE: ReadonlySet<SelectionLocation["kind"]> = new Set([
  "other-page",
  "other-site",
  "gone",
]);

/**
 * A selection asks for attention when it is flagged or known not to be on
 * this page. An unknown location (old data without a page URL) does not
 * count: it would put every old selection first.
 */
export const needsAttention = ({
  flagged,
  location,
}: AttentionFacts): boolean => flagged || NOT_HERE.has(location);
