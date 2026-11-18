import { onCleanup } from "solid-js";
import { useSelectionHoverContext } from "./context.js";
import type { SelectionHoverHandlers } from "./types.js";

/**
 * Mouse handlers for a list row or card: while the pointer is on it, the
 * selection's element is shown on the page. A row removed while hovered
 * (the list closes, the selection goes) clears the preview itself, since no
 * mouseleave follows.
 */
export const useSelectionHover = (
  itemId: () => string,
): SelectionHoverHandlers => {
  const { hover } = useSelectionHoverContext();
  let isHovered = false;

  onCleanup(() => {
    if (isHovered) hover(null);
  });

  return {
    onMouseEnter: () => {
      isHovered = true;
      hover(itemId());
    },
    onMouseLeave: () => {
      isHovered = false;
      hover(null);
    },
  };
};
