import type { CommentItem } from "../../../types.js";
import type { ScreenshotRef } from "../types.js";

export interface CommentScreenshots {
  element?: ScreenshotRef;
  fullPage?: ScreenshotRef;
}

/**
 * The uploaded screenshots of a comment. `screenshotElement` and
 * `screenshotFullPage` hold storage keys, set only once an upload succeeded.
 */
export const screenshotRefs = (
  item: Pick<CommentItem, "id" | "screenshotElement" | "screenshotFullPage">,
): CommentScreenshots => ({
  ...(item.screenshotElement
    ? { element: { selectionId: item.id, kind: "element" } }
    : {}),
  ...(item.screenshotFullPage
    ? { fullPage: { selectionId: item.id, kind: "full" } }
    : {}),
});
