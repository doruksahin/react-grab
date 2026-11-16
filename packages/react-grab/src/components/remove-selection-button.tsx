import type { Component } from "solid-js";
import { cn } from "../utils/cn.js";
import { IconX } from "./icons/icon-x.jsx";
import { IconButton } from "./ui/icon-button.js";

/**
 * Shared × button for removing a selection: neutral at rest, destructive on
 * hover, so it never reads as the loudest control. Rendered by the saved
 * selection-label and the comments menu rows; sidebar cards remove through
 * their menu (SelectionCardMenu). Presentational only:
 * a caller renders it only when the membership policy allows the removal
 * (`canRemoveItem`, ADR-0008).
 *
 * Two variants:
 *
 *   - "overlay": rendered inside the floating selection-label. Needs
 *     `data-react-grab-ignore-events` so the document-level click
 *     handler doesn't treat the click as a canvas interaction, and
 *     a pointerdown guard so the label's own pointerdown handler
 *     (which focuses the input) doesn't race the click. Also opts
 *     into the `interactive-scale` hover animation.
 *
 *   - "card" (default): rendered inside a plain sidebar card. No
 *     overlay plumbing, no animation class.
 */
interface RemoveSelectionButtonProps {
  onRemove: () => void;
  variant?: "overlay" | "card";
  class?: string;
}

export const RemoveSelectionButton: Component<RemoveSelectionButtonProps> = (
  props,
) => {
  const isOverlay = () => props.variant === "overlay";

  const handleClick = (event: MouseEvent) => {
    event.stopImmediatePropagation();
    props.onRemove();
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (!isOverlay()) return;
    event.stopPropagation();
  };

  return (
    <IconButton
      {...(isOverlay() ? { "data-react-grab-ignore-events": "" } : {})}
      data-react-grab-selection-remove
      type="button"
      label="Remove selection"
      variant="subtle-destructive"
      size="icon-xs"
      class={cn(
        "contain-layout shrink-0",
        isOverlay() && "interactive-scale",
        props.class,
      )}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      <IconX size={10} />
    </IconButton>
  );
};
