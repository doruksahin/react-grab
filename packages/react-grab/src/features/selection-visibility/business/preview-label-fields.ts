import type { CommentItem, SelectionLabelInstance } from "../../../types.js";

/** The label fields a saved selection's preview takes from its item. */
export type PreviewLabelFields = Pick<
  SelectionLabelInstance,
  | "tagName"
  | "componentName"
  | "elementsCount"
  | "isPromptMode"
  | "inputValue"
  | "groupId"
  | "commentText"
  | "timestamp"
  | "hasElementScreenshot"
  | "hasFullPageScreenshot"
>;

/**
 * Single source of the item → label projection: core's
 * addCommentItemPreview spreads it into the label, and isSamePreview
 * compares it to decide whether a preview must be redrawn.
 */
export const toPreviewLabelFields = (
  item: CommentItem,
): PreviewLabelFields => ({
  tagName: item.tagName,
  componentName: item.componentName,
  elementsCount: item.elementsCount,
  isPromptMode: Boolean(item.commentText),
  inputValue: item.commentText ?? undefined,
  groupId: item.groupId ?? undefined,
  commentText: item.commentText,
  timestamp: item.timestamp,
  hasElementScreenshot: Boolean(item.screenshotElement),
  hasFullPageScreenshot: Boolean(item.screenshotFullPage),
});

/** Whether two projections show the same label. */
export const isSameLabelFields = (
  previous: PreviewLabelFields,
  next: PreviewLabelFields,
): boolean => {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  for (const key of keys) {
    if (Reflect.get(previous, key) !== Reflect.get(next, key)) return false;
  }
  return true;
};
