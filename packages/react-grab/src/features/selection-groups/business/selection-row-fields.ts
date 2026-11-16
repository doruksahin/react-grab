import type { CommentItem } from "../../../types.js";

/** What a selection row shows, in the comments menu and the sidebar alike. */
export interface SelectionRowFields {
  /** The comment: what the person wrote. The element when there is none. */
  title: string;
  /** The element, shown second; absent when it is already the title. */
  detail?: string;
}

type RowSource = Pick<
  CommentItem,
  "commentText" | "componentName" | "tagName" | "elementsCount"
>;

const elementLabel = (item: RowSource): string =>
  item.elementsCount && item.elementsCount > 1
    ? `${item.elementsCount} elements`
    : (item.componentName ?? item.tagName);

/**
 * One reading of a selection row (ADR-0028): the comment leads, the element
 * follows. Both surfaces render these fields, at their own density.
 */
export const selectionRowFields = (item: RowSource): SelectionRowFields => {
  const comment = item.commentText?.trim();
  const element = elementLabel(item);
  return comment ? { title: comment, detail: element } : { title: element };
};
