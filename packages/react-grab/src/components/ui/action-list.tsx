import { callHandler } from "@kobalte/utils";
import type { Component, ComponentProps } from "solid-js";
import { createContext, splitProps, useContext } from "solid-js";
import { cn } from "../../utils/cn.js";
import { isKeyboardFocus } from "../../utils/is-keyboard-focus.js";
import {
  createMenuHighlight,
  type MenuHighlightController,
} from "../../utils/create-menu-highlight.js";

const ActionListContext = createContext<MenuHighlightController>();

interface ActionListProps extends Omit<ComponentProps<"div">, "ref"> {
  /** Accessible name of the group of actions. */
  label: string;
  /** Pass a controller to also move the highlight from outside (keyboard). */
  highlight?: MenuHighlightController;
  ref?: (element: HTMLDivElement) => void;
}

/**
 * A named group of action buttons inside an overlay surface that positions
 * itself (context menu, toolbar menu, arrow-key element menu, group picker).
 * Focus stays on the host page and the overlay's key handler drives these
 * lists, so they are plain buttons, not an ARIA menu. A highlight follows the
 * hovered or keyboard-focused item. Menus with a Kobalte trigger use
 * ui/menu.tsx.
 */
const ActionList: Component<ActionListProps> = (props) => {
  const [local, rest] = splitProps(props, [
    "label",
    "highlight",
    "ref",
    "class",
    "children",
  ]);
  const controller = local.highlight ?? createMenuHighlight();

  return (
    <ActionListContext.Provider value={controller}>
      <div
        role="group"
        aria-label={local.label}
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
    </ActionListContext.Provider>
  );
};

const ActionListItem: Component<ComponentProps<"button">> = (props) => {
  const [local, rest] = splitProps(props, [
    "class",
    "onPointerEnter",
    "onPointerLeave",
    "onFocus",
    "onBlur",
  ]);
  const controller = useContext(ActionListContext);

  return (
    <button
      type="button"
      class={cn(
        "relative z-1 contain-layout flex w-full cursor-pointer items-center border-none bg-transparent px-2 py-1 text-left outline-none disabled:cursor-default disabled:opacity-40",
        local.class,
      )}
      onPointerEnter={(event) => {
        if (!event.currentTarget.disabled) {
          controller?.updateHighlight(event.currentTarget);
        }
        callHandler(event, local.onPointerEnter);
      }}
      onPointerLeave={(event) => {
        controller?.clearHighlight();
        callHandler(event, local.onPointerLeave);
      }}
      onFocus={(event) => {
        if (isKeyboardFocus(event)) {
          controller?.updateHighlight(event.currentTarget);
        }
        callHandler(event, local.onFocus);
      }}
      onBlur={(event) => {
        controller?.clearHighlight();
        callHandler(event, local.onBlur);
      }}
      {...rest}
    />
  );
};

export { ActionList, ActionListItem };
