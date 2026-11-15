import type { CommentItem } from "../../../types.js";

/** What a revealed selection's preview is drawn from: the item and its elements. */
export interface PreviewSource {
  item: CommentItem;
  elements: Element[];
}

/**
 * Whether two sources draw the same preview: the same elements, and the same
 * values for the fields the box and its label show. A change anywhere else
 * on the item (or to another item) keeps the preview mounted.
 */
export const isSamePreview = (
  previous: PreviewSource | null,
  next: PreviewSource | null,
): boolean => {
  if (!previous || !next) return previous === next;
  const a = previous.item;
  const b = next.item;
  return (
    previous.elements.length === next.elements.length &&
    previous.elements.every(
      (element, index) => element === next.elements[index],
    ) &&
    a.tagName === b.tagName &&
    a.componentName === b.componentName &&
    a.elementsCount === b.elementsCount &&
    a.commentText === b.commentText &&
    a.groupId === b.groupId &&
    a.timestamp === b.timestamp &&
    Boolean(a.screenshotElement) === Boolean(b.screenshotElement) &&
    Boolean(a.screenshotFullPage) === Boolean(b.screenshotFullPage)
  );
};
