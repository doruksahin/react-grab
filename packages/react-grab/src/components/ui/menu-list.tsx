import type { Component, ComponentProps } from "solid-js";
import { createContext, splitProps, useContext } from "solid-js";
import { callEventHandler } from "../../utils/call-event-handler.js";
import { cn } from "../../utils/cn.js";
import {
  createMenuHighlight,
  type MenuHighlightController,
} from "../../utils/create-menu-highlight.js";

const MenuListContext = createContext<MenuHighlightController>();

interface MenuListProps extends Omit<ComponentProps<"div">, "ref"> {
  /** Pass a controller to also move the highlight from outside (keyboard). */
  highlight?: MenuHighlightController;
  ref?: (element: HTMLDivElement) => void;
}

/**
 * A list of menu items inside an overlay surface that positions itself (the
 * context menu, the toolbar menu, the arrow-key element menu). A highlight
 * follows the hovered item. Menus with a Kobalte trigger use ui/menu.tsx.
 */
const MenuList: Component<MenuListProps> = (props) => {
  const [local, rest] = splitProps(props, [
    "highlight",
    "ref",
    "class",
    "children",
  ]);
  const controller = local.highlight ?? createMenuHighlight();

  return (
    <MenuListContext.Provider value={controller}>
      <div
        role="menu"
        ref={(element) => {
          controller.containerRef(element);
          local.ref?.(element);
        }}
        class={cn("relative flex flex-col", local.class)}
        {...rest}
      >
        <div
          ref={controller.highlightRef}
          aria-hidden="true"
          class="pointer-events-none absolute bg-accent opacity-0 transition-[top,left,width,height,opacity] duration-75 ease-out"
        />
        {local.children}
      </div>
    </MenuListContext.Provider>
  );
};

const MenuListItem: Component<ComponentProps<"button">> = (props) => {
  const [local, rest] = splitProps(props, [
    "class",
    "onPointerEnter",
    "onPointerLeave",
    "onMouseDown",
  ]);
  const controller = useContext(MenuListContext);

  return (
    <button
      type="button"
      role="menuitem"
      class={cn(
        "relative z-1 contain-layout flex w-full cursor-pointer items-center border-none bg-transparent px-2 py-1 text-left outline-none disabled:cursor-default disabled:opacity-40",
        local.class,
      )}
      onPointerEnter={(event) => {
        if (!event.currentTarget.disabled) {
          controller?.updateHighlight(event.currentTarget);
        }
        callEventHandler(local.onPointerEnter, event);
      }}
      onPointerLeave={(event) => {
        controller?.clearHighlight();
        callEventHandler(local.onPointerLeave, event);
      }}
      // The overlay's keyboard handler drives these menus. A focused
      // role="menuitem" counts as a host-page control for that handler
      // (is-keyboard-event-triggered-by-input.ts), so choosing a row with the
      // pointer must not move focus into it, or the arrow keys stop working.
      onMouseDown={(event) => {
        callEventHandler(local.onMouseDown, event);
        event.preventDefault();
      }}
      {...rest}
    />
  );
};

export { MenuList, MenuListItem };
