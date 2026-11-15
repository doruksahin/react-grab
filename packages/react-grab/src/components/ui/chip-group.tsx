import { ToggleGroup as ToggleGroupPrimitive } from "@kobalte/core/toggle-group";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";

// A single-choice row of pill toggles, such as a filter (Kobalte ToggleGroup).
const ChipGroup: Component<ComponentProps<typeof ToggleGroupPrimitive>> = (
  props,
) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <ToggleGroupPrimitive
      class={cn("flex flex-wrap gap-1.5", local.class)}
      {...rest}
    />
  );
};

const ChipGroupItem: Component<
  ComponentProps<typeof ToggleGroupPrimitive.Item>
> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <ToggleGroupPrimitive.Item
      data-react-grab-chip
      class={cn(
        "group/chip inline-flex h-7 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-input bg-transparent px-2.5 text-caption font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[pressed]:border-transparent data-[pressed]:bg-foreground data-[pressed]:text-background",
        local.class,
      )}
      {...rest}
    />
  );
};

// The count after a chip's label.
const ChipGroupCount: Component<ComponentProps<"span">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <span
      class={cn(
        "tabular-nums text-muted-foreground group-data-[pressed]/chip:text-background/70",
        local.class,
      )}
      {...rest}
    />
  );
};

export { ChipGroup, ChipGroupCount, ChipGroupItem };
