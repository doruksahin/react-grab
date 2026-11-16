import { Show, onMount, onCleanup } from "solid-js";
import type { Component } from "solid-js";
import type { DropdownAnchor } from "../types.js";
import { DROPDOWN_EDGE_TRANSFORM_ORIGIN } from "../constants.js";
import { cn } from "../utils/cn.js";
import { DiscardPrompt } from "./selection-label/discard-prompt.js";
import { suppressMenuEvent } from "../utils/suppress-menu-event.js";
import { createAnchoredDropdown } from "../utils/create-anchored-dropdown.js";
import { registerOverlayDismiss } from "../utils/register-overlay-dismiss.js";

interface ClearCommentsPromptProps {
  position: DropdownAnchor | null;
  /** Comments that stay because they have a ticket (ADR-0008). */
  keptCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ClearCommentsPrompt: Component<ClearCommentsPromptProps> = (
  props,
) => {
  let containerRef: HTMLDivElement | undefined;

  const dropdown = createAnchoredDropdown(
    () => containerRef,
    () => props.position,
  );

  onMount(() => {
    const unregisterOverlayDismiss = registerOverlayDismiss({
      isOpen: () => Boolean(props.position),
      onDismiss: props.onCancel,
      onConfirm: props.onConfirm,
      shouldIgnoreInputEvents: true,
    });

    onCleanup(() => {
      dropdown.clearAnimationHandles();
      unregisterOverlayDismiss();
    });
  });

  return (
    <Show when={dropdown.shouldMount()}>
      <div
        ref={containerRef}
        data-react-grab-ignore-events
        data-react-grab-clear-comments-prompt
        class="fixed text-body antialiased drop-shadow-overlay select-none transition-[opacity,transform] duration-100 ease-out will-change-[opacity,transform]"
        style={{
          ...dropdown.floatingStyle(),
          "z-index": "var(--z-dialog)",
          "pointer-events": dropdown.isAnimatedIn() ? "auto" : "none",
          "transform-origin":
            DROPDOWN_EDGE_TRANSFORM_ORIGIN[dropdown.lastAnchorEdge()],
          opacity: dropdown.isAnimatedIn() ? "1" : "0",
          transform: dropdown.isAnimatedIn() ? "scale(1)" : "scale(0.95)",
        }}
        onPointerDown={suppressMenuEvent}
        onMouseDown={suppressMenuEvent}
        onClick={suppressMenuEvent}
        onContextMenu={suppressMenuEvent}
      >
        <div
          class={cn(
            "contain-layout flex flex-col rounded-[10px] antialiased w-fit h-fit [font-synthesis:none] [corner-shape:superellipse(1.25)]",
            "bg-popover",
          )}
        >
          <DiscardPrompt
            label={
              props.keptCount > 0
                ? `Clear comments? ${props.keptCount} with a ticket stay.`
                : "Clear comments?"
            }
            cancelOnEscape
            onConfirm={props.onConfirm}
            onCancel={props.onCancel}
          />
        </div>
      </div>
    </Show>
  );
};
