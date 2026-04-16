import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import {
  type Component,
  type ComponentProps,
  mergeProps,
  splitProps,
} from "solid-js";
import { cn } from "../../utils/cn.js";
import { useShadowMount } from "../../utils/shadow-context.js";

// Module-level reference to the currently mounted MenuContent DOM element.
// MenuSubTrigger dispatches a synthetic pointerdown on this element when the
// pointer enters a sub-trigger, so Kobalte's DismissableLayer fires for any
// currently-open sibling sub-menu and closes it before the new sub hover-opens.
// (DismissableLayer only fires on pointerdown — hover alone does not close subs.)
let activeMenuContentEl: HTMLElement | null = null;

export const Menu: Component<ComponentProps<typeof DropdownMenu>> = (props) => {
  return <DropdownMenu {...props} />;
};

export const MenuTrigger: Component<
  ComponentProps<typeof DropdownMenu.Trigger>
> = (props) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <DropdownMenu.Trigger
      class={cn(
        "relative inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 h-7 text-[11px] text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 data-[expanded]:border-primary/70 data-[expanded]:bg-accent/30",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </DropdownMenu.Trigger>
  );
};

export const MenuContent: Component<
  ComponentProps<typeof DropdownMenu.Content>
> = (props) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <DropdownMenu.Portal mount={useShadowMount()}>
      <DropdownMenu.Content
        ref={(el) => { activeMenuContentEl = el; }}
        class={cn(
          "z-50 min-w-[14rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95",
          local.class,
        )}
        {...rest}
      >
        {local.children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
};

export const MenuItem: Component<ComponentProps<typeof DropdownMenu.Item>> = (
  props,
) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <DropdownMenu.Item
      class={cn(
        "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-[12px] outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        local.class,
      )}
      {...rest}
    />
  );
};

export const MenuSub: Component<ComponentProps<typeof DropdownMenu.Sub>> = (
  props,
) => {
  return <DropdownMenu.Sub {...props} />;
};

export const MenuSubTrigger: Component<
  ComponentProps<typeof DropdownMenu.SubTrigger>
> = (props) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <DropdownMenu.SubTrigger
      onPointerEnter={() => {
        // Kobalte's DismissableLayer only fires on pointerdown, not hover.
        // Hovering a second sub-trigger would otherwise leave the previous sub
        // open. Dispatching a synthetic pointerdown on the parent menu content
        // element (not inside any sub-content) triggers DismissableLayer for
        // any open sibling sub and closes it naturally.
        activeMenuContentEl?.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, composed: true }),
        );
      }}
      class={cn(
        "flex cursor-default select-none items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-[12px] outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[expanded]:bg-accent data-[expanded]:text-accent-foreground",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </DropdownMenu.SubTrigger>
  );
};

export const MenuSubContent: Component<
  ComponentProps<typeof DropdownMenu.SubContent>
> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <DropdownMenu.Portal mount={useShadowMount()}>
      <DropdownMenu.SubContent
        class={cn(
          "z-50 min-w-[12rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none data-[expanded]:animate-in data-[expanded]:fade-in-0 data-[expanded]:zoom-in-95",
          local.class,
        )}
        {...rest}
      />
    </DropdownMenu.Portal>
  );
};

export const MenuRadioGroup = DropdownMenu.RadioGroup;

export const MenuSeparator = DropdownMenu.Separator;

export const MenuRadioItem: Component<
  ComponentProps<typeof DropdownMenu.RadioItem>
> = (rawProps) => {
  // closeOnSelect: false — keeps the menu open after picking a filter value.
  const props = mergeProps({ closeOnSelect: false }, rawProps);
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <DropdownMenu.RadioItem
      class={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pl-7 pr-2 text-[12px] outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        local.class,
      )}
      {...rest}
    >
      <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenu.ItemIndicator>
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
          >
            <path fill="currentColor" d="m13.959 3.97-7.25 9a.75.75 0 0 1-1.163.007l-3.5-4.25 1.158-.954 2.914 3.539 6.673-8.283z" />
          </svg>
        </DropdownMenu.ItemIndicator>
      </span>
      {local.children}
    </DropdownMenu.RadioItem>
  );
};
