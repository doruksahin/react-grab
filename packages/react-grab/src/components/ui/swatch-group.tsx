import { ToggleGroup as ToggleGroupPrimitive } from "@kobalte/core/toggle-group";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";

// A single-choice group of colour swatches (Kobalte ToggleGroup).
const SwatchGroup: Component<ComponentProps<typeof ToggleGroupPrimitive>> = (
  props,
) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <ToggleGroupPrimitive
      class={cn("grid grid-cols-5 gap-1", local.class)}
      {...rest}
    />
  );
};

interface SwatchGroupItemProps extends ComponentProps<
  typeof ToggleGroupPrimitive.Item
> {
  color: string;
}

const SwatchGroupItem: Component<SwatchGroupItemProps> = (props) => {
  const [local, rest] = splitProps(props, ["class", "color"]);
  return (
    <ToggleGroupPrimitive.Item
      class={cn(
        "size-6 cursor-pointer rounded-md border-2 border-transparent transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[pressed]:border-foreground",
        local.class,
      )}
      style={{ background: local.color }}
      {...rest}
    />
  );
};

export { SwatchGroup, SwatchGroupItem };
