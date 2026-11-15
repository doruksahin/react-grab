import { Show, For, onMount, onCleanup } from "solid-js";
import type { Component } from "solid-js";
import type { ContextMenuAction, DropdownAnchor } from "../../types.js";
import {
  DROPDOWN_EDGE_TRANSFORM_ORIGIN,
  TOOLBAR_MENU_MIN_WIDTH_PX,
} from "../../constants.js";
import { cn } from "../../utils/cn.js";
import { formatShortcut } from "../../utils/format-shortcut.js";
import { suppressMenuEvent } from "../../utils/suppress-menu-event.js";
import { createAnchoredDropdown } from "../../utils/create-anchored-dropdown.js";
import { registerOverlayDismiss } from "../../utils/register-overlay-dismiss.js";
import { ActionList, ActionListItem } from "../ui/action-list.js";

interface ToolbarMenuProps {
  position: DropdownAnchor | null;
  actions: ContextMenuAction[];
  defaultActionId: string;
  onSetDefaultAction: (actionId: string) => void;
  onDismiss: () => void;
}

export const ToolbarMenu: Component<ToolbarMenuProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;

  const dropdown = createAnchoredDropdown(
    () => containerRef,
    () => props.position,
  );

  const handleActionClick = (action: ContextMenuAction, event: Event) => {
    event.stopPropagation();
    props.onSetDefaultAction(action.id);
    props.onDismiss();
  };

  onMount(() => {
    const unregisterOverlayDismiss = registerOverlayDismiss({
      isOpen: () => Boolean(props.position),
      onDismiss: props.onDismiss,
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
        data-react-grab-toolbar-menu
        class="fixed text-body antialiased drop-shadow-overlay select-none transition-[opacity,transform] duration-100 ease-out will-change-[opacity,transform]"
        style={{
          top: `${dropdown.displayPosition().top}px`,
          left: `${dropdown.displayPosition().left}px`,
          "z-index": "var(--z-dropdown)",
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
            "contain-layout flex flex-col rounded-[10px] antialiased w-fit h-fit overflow-hidden [font-synthesis:none] [corner-shape:superellipse(1.25)]",
            "bg-popover",
          )}
          style={{ "min-width": `${TOOLBAR_MENU_MIN_WIDTH_PX}px` }}
        >
          <ActionList label="Toolbar actions" class="py-1">
            <For each={props.actions}>
              {(action) => {
                const isDefault = () => action.id === props.defaultActionId;

                return (
                  <ActionListItem
                    data-react-grab-ignore-events
                    data-react-grab-menu-item={action.id}
                    class="justify-between"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => handleActionClick(action, event)}
                  >
                    <span
                      class={cn(
                        "text-body leading-4 font-medium",
                        isDefault()
                          ? "text-popover-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {action.label}
                    </span>
                    <Show when={action.shortcut}>
                      {(shortcutKey) => (
                        <span class="text-meta text-muted-foreground ml-4">
                          {formatShortcut(shortcutKey())}
                        </span>
                      )}
                    </Show>
                  </ActionListItem>
                );
              }}
            </For>
          </ActionList>
        </div>
      </div>
    </Show>
  );
};
