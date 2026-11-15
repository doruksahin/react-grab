import { Show, For, createEffect } from "solid-js";
import type { Component } from "solid-js";
import type { ArrowNavigationItem } from "../../types.js";
import { createMenuHighlight } from "../../utils/create-menu-highlight.js";
import { BottomSection } from "./bottom-section.js";
import { ActionList, ActionListItem } from "../ui/action-list.js";

interface ArrowNavigationMenuProps {
  items: ArrowNavigationItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export const ArrowNavigationMenu: Component<ArrowNavigationMenuProps> = (
  props,
) => {
  const highlight = createMenuHighlight();

  let menuItemsRef: HTMLDivElement | undefined;
  let didPointerMove = false;

  const getMenuItemByIndex = (
    itemIndex: number,
  ): HTMLButtonElement | undefined => {
    if (!menuItemsRef) return undefined;
    const activeMenuButton = menuItemsRef.querySelector<HTMLButtonElement>(
      `[data-react-grab-arrow-nav-index="${itemIndex}"]`,
    );
    return activeMenuButton ?? undefined;
  };

  createEffect(() => {
    void props.items;
    didPointerMove = false;
  });

  createEffect(() => {
    const activeMenuItem = getMenuItemByIndex(props.activeIndex);
    if (activeMenuItem) {
      highlight.updateHighlight(activeMenuItem);
    }
  });

  return (
    <BottomSection>
      <ActionList
        label="Element hierarchy"
        highlight={highlight}
        ref={(element) => {
          menuItemsRef = element;
        }}
        class="w-[calc(100%+16px)] -mx-2 -my-1.5"
        onPointerMove={() => {
          didPointerMove = true;
        }}
      >
        <For each={props.items}>
          {(item, itemIndex) => (
            <ActionListItem
              data-react-grab-ignore-events
              data-react-grab-arrow-nav-item={item.tagName}
              data-react-grab-arrow-nav-index={itemIndex()}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerEnter={() => {
                if (didPointerMove) {
                  props.onSelect(itemIndex());
                }
              }}
              onPointerLeave={() => {
                const activeMenuItem = getMenuItemByIndex(props.activeIndex);
                if (activeMenuItem) highlight.updateHighlight(activeMenuItem);
              }}
              onClick={(event) => {
                event.stopPropagation();
                props.onSelect(itemIndex());
              }}
            >
              <span
                class="text-body leading-4 h-fit font-medium overflow-hidden text-ellipsis whitespace-nowrap min-w-0 transition-colors"
                classList={{
                  "text-popover-foreground": itemIndex() === props.activeIndex,
                  "text-muted-foreground": itemIndex() !== props.activeIndex,
                }}
              >
                <Show when={item.componentName}>
                  {item.componentName}
                  <span class="text-muted-foreground">.</span>
                </Show>
                {item.tagName}
              </span>
            </ActionListItem>
          )}
        </For>
      </ActionList>
    </BottomSection>
  );
};
