import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";
import { useShadowMount } from "../../utils/shadow-context.js";

// Re-export root and sub unchanged
export const Menu = DropdownMenu;
export const MenuSub = DropdownMenu.Sub;
export const MenuRadioGroup = DropdownMenu.RadioGroup;
export const MenuSeparator = DropdownMenu.Separator;

export const MenuTrigger: Component<ComponentProps<typeof DropdownMenu.Trigger>> = (props) => {
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

export const MenuContent: Component<ComponentProps<typeof DropdownMenu.Content>> = (props) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <DropdownMenu.Portal mount={useShadowMount()}>
      <DropdownMenu.Content
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

export const MenuItem: Component<ComponentProps<typeof DropdownMenu.Item>> = (props) => {
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

export const MenuSubTrigger: Component<ComponentProps<typeof DropdownMenu.SubTrigger>> = (props) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <DropdownMenu.SubTrigger
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

export const MenuSubContent: Component<ComponentProps<typeof DropdownMenu.SubContent>> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <DropdownMenu.Portal mount={useShadowMount()}>
      <DropdownMenu.SubContent
        class={cn(
          "z-50 min-w-[12rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95",
          local.class,
        )}
        {...rest}
      />
    </DropdownMenu.Portal>
  );
};

export const MenuRadioItem: Component<ComponentProps<typeof DropdownMenu.RadioItem>> = (props) => {
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
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </DropdownMenu.ItemIndicator>
      </span>
      {local.children}
    </DropdownMenu.RadioItem>
  );
};
