import { Popover as PopoverPrimitive } from "@kobalte/core/popover";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";
import { useShadowMount } from "../../utils/shadow-context.js";

// Kobalte Popover (Floating UI inside), portalled into the shadow root.
const Popover = PopoverPrimitive;
const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent: Component<
  ComponentProps<typeof PopoverPrimitive.Content>
> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <PopoverPrimitive.Portal mount={useShadowMount()}>
      <PopoverPrimitive.Content
        class={cn(
          "rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none",
          local.class,
        )}
        {...rest}
        style={{ "z-index": "var(--z-dropdown)", "pointer-events": "auto" }}
      />
    </PopoverPrimitive.Portal>
  );
};

export { Popover, PopoverContent, PopoverTrigger };
