import type { CommentItem } from "../../../types.js";
import {
  isSameLabelFields,
  toPreviewLabelFields,
} from "./preview-label-fields.js";

/** What a revealed selection's preview is drawn from: the item and its elements. */
export interface PreviewSource {
  item: CommentItem;
  elements: Element[];
}

/**
 * Whether two sources draw the same preview: the same elements and the same
 * label fields. A change anywhere else on the item keeps the preview mounted.
 */
export const isSamePreview = (
  previous: PreviewSource,
  next: PreviewSource,
): boolean =>
  previous.elements.length === next.elements.length &&
  previous.elements.every(
    (element, index) => element === next.elements[index],
  ) &&
  isSameLabelFields(
    toPreviewLabelFields(previous.item),
    toPreviewLabelFields(next.item),
  );
