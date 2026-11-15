import type { SelectionLabelInstance } from "../../../types.js";

/**
 * A label shows as a pin when it stands for a saved selection (it carries
 * the selection's item id). Copy feedback and the passing card of a hovered
 * comment carry none and stay plain labels.
 */
export const isPinnedLabel = (
  instance: Pick<SelectionLabelInstance, "itemId">,
): boolean => Boolean(instance.itemId);
