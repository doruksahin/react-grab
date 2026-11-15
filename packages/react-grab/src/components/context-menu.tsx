import {
  Show,
  For,
  onMount,
  onCleanup,
  createSignal,
  createMemo,
} from "solid-js";
import type { Component } from "solid-js";
import type {
  Position,
  OverlayBounds,
  ContextMenuAction,
  ContextMenuActionContext,
} from "../types.js";
import {
  ARROW_HEIGHT_PX,
  DROPDOWN_OFFSCREEN_POSITION,
  LABEL_GAP_PX,
} from "../constants.js";
import { cn } from "../utils/cn.js";
import { Arrow } from "./selection-label/arrow.js";
import { TagBadge } from "./selection-label/tag-badge.js";
import { BottomSection } from "./selection-label/bottom-section.js";
import { formatShortcut } from "../utils/format-shortcut.js";
import { getTagDisplay } from "../utils/get-tag-display.js";
import { resolveActionEnabled } from "../utils/resolve-action-enabled.js";
import { createFloating, virtualReference } from "../utils/floating.js";
import type { ArrowPosition } from "../types.js";
import { suppressMenuEvent } from "../utils/suppress-menu-event.js";
import { registerOverlayDismiss } from "../utils/register-overlay-dismiss.js";
import { ActionList, ActionListItem } from "./ui/action-list.js";

interface ContextMenuProps {
  position: Position | null;
  selectionBounds: OverlayBounds | null;
  tagName?: string;
  componentName?: string;
  hasFilePath: boolean;
  actions?: ContextMenuAction[];
  actionContext?: ContextMenuActionContext;
  onDismiss: () => void;
  onHide: () => void;
}

interface MenuItem {
  label: string;
  action: () => void;
  enabled: boolean;
  shortcut?: string;
}

interface MenuPosition {
  left: number;
  top: number;
  arrowLeft: number;
  arrowPosition: ArrowPosition;
}

export const ContextMenu: Component<ContextMenuProps> = (props) => {
  const [container, setContainer] = createSignal<HTMLDivElement>();

  const isVisible = () => props.position !== null;

  const tagDisplayResult = createMemo(() =>
    getTagDisplay({
      tagName: props.tagName,
      componentName: props.componentName,
    }),
  );

  // Below the element at the cursor's x, flipping above when it does not fit.
  const floatingPosition = createFloating({
    reference: () => {
      const bounds = props.selectionBounds;
      const clickPosition = props.position;
      if (!bounds || !clickPosition) return null;
      const cursorX = clickPosition.x ?? bounds.x + bounds.width / 2;
      return virtualReference(() => ({
        x: cursorX,
        y: bounds.y,
        width: 0,
        height: bounds.height,
      }));
    },
    floating: container,
    options: () => ({
      placement: "bottom",
      fallbackPlacements: ["top"],
      offsetPx: ARROW_HEIGHT_PX + LABEL_GAP_PX,
      paddingPx: LABEL_GAP_PX,
      anchorPaddingPx: ARROW_HEIGHT_PX,
    }),
  });

  const computedPosition = (): MenuPosition => {
    const position = isVisible() ? floatingPosition() : null;
    if (!position) {
      return {
        left: DROPDOWN_OFFSCREEN_POSITION.left,
        top: DROPDOWN_OFFSCREEN_POSITION.top,
        arrowLeft: 0,
        arrowPosition: "bottom",
      };
    }
    return {
      left: position.x,
      top: position.y,
      arrowLeft: position.anchorOffsetX,
      arrowPosition: position.placement.startsWith("top") ? "top" : "bottom",
    };
  };

  const menuItems = createMemo<MenuItem[]>(() => {
    const pluginActions = props.actions ?? [];
    const context = props.actionContext;

    return pluginActions.map((action) => ({
      label: action.label,
      action: () => {
        if (context) {
          action.onAction(context);
        }
      },
      enabled: resolveActionEnabled(action, context),
      shortcut: action.shortcut,
    }));
  });

  const handleAction = (item: MenuItem, event: Event) => {
    event.stopPropagation();
    if (item.enabled) {
      item.action();
      props.onHide();
    }
  };

  onMount(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isVisible()) return;

      const isEnter = event.key === "Enter";
      const hasModifierKey = event.metaKey || event.ctrlKey;
      const keyLower = event.key.toLowerCase();

      const pluginActions = props.actions ?? [];
      const context = props.actionContext;

      const runActionIfAllowed = (action: ContextMenuAction) => {
        if (!context) return false;
        if (!resolveActionEnabled(action, context)) return false;
        event.preventDefault();
        event.stopPropagation();
        action.onAction(context);
        props.onHide();
        return true;
      };

      if (isEnter) {
        const enterAction = pluginActions.find(
          (action) => action.shortcut === "Enter",
        );
        if (enterAction) {
          runActionIfAllowed(enterAction);
        }
        return;
      }

      if (!hasModifierKey) return;
      if (event.repeat) return;

      const modifierAction = pluginActions.find(
        (action) =>
          action.shortcut &&
          action.shortcut !== "Enter" &&
          keyLower === action.shortcut.toLowerCase(),
      );
      if (modifierAction) {
        runActionIfAllowed(modifierAction);
      }
    };

    const unregisterOverlayDismiss = registerOverlayDismiss({
      isOpen: isVisible,
      onDismiss: props.onDismiss,
      shouldIgnoreRightClick: true,
    });
    window.addEventListener("keydown", handleKeyDown, { capture: true });

    onCleanup(() => {
      unregisterOverlayDismiss();
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    });
  });

  return (
    <Show when={isVisible()}>
      <div
        ref={setContainer}
        data-react-grab-ignore-events
        data-react-grab-context-menu
        class="fixed text-body antialiased drop-shadow-overlay select-none"
        style={{
          top: `${computedPosition().top}px`,
          left: `${computedPosition().left}px`,
          "z-index": "var(--z-dropdown)",
          "pointer-events": "auto",
        }}
        onPointerDown={suppressMenuEvent}
        onMouseDown={suppressMenuEvent}
        onClick={suppressMenuEvent}
        onContextMenu={suppressMenuEvent}
      >
        <Arrow
          position={computedPosition().arrowPosition}
          leftPercent={0}
          leftOffsetPx={computedPosition().arrowLeft}
        />

        <div
          class={cn(
            "contain-layout flex flex-col justify-center items-start rounded-[10px] antialiased w-fit h-fit min-w-[100px] [font-synthesis:none] [corner-shape:superellipse(1.25)]",
            "bg-popover",
          )}
        >
          <div class="contain-layout shrink-0 flex items-center gap-1 pt-1.5 pb-1 w-fit h-fit px-2">
            <TagBadge
              tagName={tagDisplayResult().tagName}
              componentName={tagDisplayResult().componentName}
              isClickable={props.hasFilePath}
              onClick={(event) => {
                event.stopPropagation();
                if (props.hasFilePath && props.actionContext) {
                  const openAction = props.actions?.find(
                    (action) => action.id === "open",
                  );
                  openAction?.onAction(props.actionContext);
                }
              }}
              shrink
              forceShowIcon={props.hasFilePath}
            />
          </div>
          <BottomSection>
            <ActionList
              label="Element actions"
              class="w-[calc(100%+16px)] -mx-2 -my-1.5"
            >
              <For each={menuItems()}>
                {(item) => (
                  <ActionListItem
                    data-react-grab-ignore-events
                    data-react-grab-menu-item={item.label.toLowerCase()}
                    class="justify-between"
                    disabled={!item.enabled}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => handleAction(item, event)}
                  >
                    <span class="text-body leading-4 font-medium text-popover-foreground">
                      {item.label}
                    </span>
                    <Show when={item.shortcut}>
                      {(shortcut) => (
                        <span class="text-meta text-muted-foreground ml-4">
                          {formatShortcut(shortcut())}
                        </span>
                      )}
                    </Show>
                  </ActionListItem>
                )}
              </For>
            </ActionList>
          </BottomSection>
        </div>
      </div>
    </Show>
  );
};
