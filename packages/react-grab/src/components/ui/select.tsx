import { Select as SelectPrimitive } from "@kobalte/core/select";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";
import { useShadowMount } from "../../utils/shadow-context.js";

// Re-export root unchanged
const Select = SelectPrimitive;

const SelectPortal: Component<ComponentProps<typeof SelectPrimitive.Portal>> = (
  props,
) => {
  return <SelectPrimitive.Portal {...props} mount={useShadowMount()} />;
};

const SelectTrigger: Component<
  ComponentProps<typeof SelectPrimitive.Trigger>
> = (props) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <SelectPrimitive.Trigger
      class={cn(
        "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        local.class,
      )}
      {...rest}
    >
      {local.children}
      <SelectPrimitive.Icon class="flex items-center justify-center opacity-50">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path
            fill="currentColor"
            d="m14.53 6.03-6 6a.75.75 0 0 1-1.004.052l-.056-.052-6-6 1.06-1.06L8 10.44l5.47-5.47z"
          />
        </svg>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
};

const SelectValue = SelectPrimitive.Value;

const SelectContent: Component<
  ComponentProps<typeof SelectPrimitive.Content>
> = (props) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <SelectPortal>
      <SelectPrimitive.Content
        class={cn(
          "relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95",
          local.class,
        )}
        {...rest}
      >
        <SelectPrimitive.Listbox class="p-1" />
        {local.children}
      </SelectPrimitive.Content>
    </SelectPortal>
  );
};

const SelectItem: Component<ComponentProps<typeof SelectPrimitive.Item>> = (
  props,
) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <SelectPrimitive.Item
      class={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        local.class,
      )}
      {...rest}
    >
      <SelectPrimitive.ItemIndicator class="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path
            fill="currentColor"
            d="m13.959 3.97-7.25 9a.75.75 0 0 1-1.163.007l-3.5-4.25 1.158-.954 2.914 3.539 6.673-8.283z"
          />
        </svg>
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemLabel>{local.children}</SelectPrimitive.ItemLabel>
    </SelectPrimitive.Item>
  );
};

const SelectLabel: Component<ComponentProps<typeof SelectPrimitive.Label>> = (
  props,
) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <SelectPrimitive.Label
      class={cn("px-2 py-1.5 text-sm font-semibold", local.class)}
      {...rest}
    />
  );
};

const SelectSeparator: Component<ComponentProps<"hr">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return <hr class={cn("-mx-1 my-1 h-px bg-muted", local.class)} {...rest} />;
};

export {
  Select,
  SelectPortal,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
};
