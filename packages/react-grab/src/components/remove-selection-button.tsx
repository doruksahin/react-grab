import type { Component } from "solid-js";
import { cn } from "../utils/cn.js";
import { IconX } from "./icons/icon-x.jsx";

/**
 * Shared red × button for removing a selection. Rendered by the
 * selection-label (both idle and prompt-mode branches) and by the
 * sidebar selection cards. Presentational only — visibility and
 * ticket-lock gating are decided by the caller.
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
    <button
      {...(isOverlay() ? { "data-react-grab-ignore-events": "" } : {})}
      data-react-grab-remove
      type="button"
      aria-label="Remove selection"
      title="Remove selection"
      class={cn(
        "contain-layout shrink-0 flex items-center justify-center size-4 rounded-full bg-red-500 text-white cursor-pointer",
        isOverlay() && "interactive-scale",
        props.class,
      )}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      <IconX size={8} />
    </button>
  );
};
