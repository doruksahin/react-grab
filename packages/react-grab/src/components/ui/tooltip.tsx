import { Tooltip as TooltipPrimitive } from "@kobalte/core/tooltip";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";
import { useShadowMount } from "../../utils/shadow-context.js";

// Re-export root and trigger unchanged
const Tooltip = TooltipPrimitive;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipPortal: Component<ComponentProps<typeof TooltipPrimitive.Portal>> = (props) => {
  return <TooltipPrimitive.Portal {...props} mount={useShadowMount()} />;
};

const TooltipContent: Component<ComponentProps<typeof TooltipPrimitive.Content>> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <TooltipPortal>
      <TooltipPrimitive.Content
        class={cn(
          "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95",
          local.class,
        )}
        {...rest}
      />
    </TooltipPortal>
  );
};

export { Tooltip, TooltipTrigger, TooltipPortal, TooltipContent };
