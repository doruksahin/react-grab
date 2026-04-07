import { Tooltip as TooltipPrimitive } from "@kobalte/core/tooltip";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";
import { useShadowRoot } from "../../features/sidebar/shadow-context.js";

// Re-export root and trigger unchanged
const Tooltip = TooltipPrimitive;
const TooltipTrigger = TooltipPrimitive.Trigger;

// Portal — auto-mounts inside shadow DOM via context.
// useShadowRoot() returns ShadowRoot | null — NOT a signal, do not invoke it.
// Spread props BEFORE mount so context always wins over any caller-supplied mount.
const TooltipPortal: Component<ComponentProps<typeof TooltipPrimitive.Portal>> = (props) => {
  const shadowRoot = useShadowRoot(); // ShadowRoot | null
  return <TooltipPrimitive.Portal {...props} mount={(shadowRoot ?? document.body) as HTMLElement} />;
};

const TooltipContent: Component<ComponentProps<typeof TooltipPrimitive.Content>> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <TooltipPrimitive.Content
      class={cn(
        "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95",
        local.class,
      )}
      {...rest}
    />
  );
};

export { Tooltip, TooltipTrigger, TooltipPortal, TooltipContent };
