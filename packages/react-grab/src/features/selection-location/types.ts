/** Where a saved selection is, relative to the page being viewed (ADR-0024). */
export type SelectionLocation =
  | { kind: "on-page" }
  | { kind: "other-page"; url: string; path: string }
  | { kind: "other-site"; host: string }
  | { kind: "gone" }
  | { kind: "unknown" };

export interface LocateSelectionInput {
  /** The URL stored when the selection was made; absent on very old data. */
  pageUrl: string | undefined;
  currentUrl: string;
  /** Whether the selection's element is on the page now. */
  isOnPage: boolean;
}
