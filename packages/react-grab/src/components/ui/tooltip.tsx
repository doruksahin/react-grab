import { Tooltip as TooltipPrimitive } from "@kobalte/core/tooltip";
import type { Component, ComponentProps } from "solid-js";
import { createEffect, createSignal, onCleanup, splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";
import { useShadowMount } from "../../utils/shadow-context.js";

/**
 * Tooltip wrapper that avoids Kobalte's internal setTimeout for hover delay.
 *
 * When `openDelay` or `closeDelay` is passed, Kobalte normally schedules a
 * setTimeout to toggle open state. That timeout runs without a Solid.js
 * reactive owner, so any computations created during the mount (disclosure
 * state, presence animations) leak — "computations created outside a
 * createRoot" warning, never disposed.
 *
 * Fix: when delay props are present, we intercept them, manage the delay
 * with a createEffect (which has proper owner), and pass `forceMount` +
 * controlled `open` to Kobalte. Kobalte never sees delay props, never
 * creates its own setTimeout.
 *
 * Already-controlled tooltips (`open` prop passed) are forwarded unchanged.
 */

type TooltipRootProps = ComponentProps<typeof TooltipPrimitive>;

const Tooltip: Component<TooltipRootProps> = (props) => {
  const [local, rest] = splitProps(props, [
    "openDelay",
    "closeDelay",
    "open",
    "onOpenChange",
    "forceMount",
    "children",
  ]);

  const isControlledExternally = () => local.open !== undefined;

  // Only create delay machinery when uncontrolled with delays
  if (isControlledExternally()) {
    return (
      <TooltipPrimitive
        open={local.open}
        onOpenChange={local.onOpenChange}
        forceMount={local.forceMount}
        {...rest}
      >
        {local.children}
      </TooltipPrimitive>
    );
  }

  const openDelay = () => local.openDelay ?? 0;
  const closeDelay = () => local.closeDelay ?? 0;
  const [delayedOpen, setDelayedOpen] = createSignal(false);
  const [hoverIntent, setHoverIntent] = createSignal(false);

  let timeout: ReturnType<typeof setTimeout> | undefined;

  createEffect(() => {
    clearTimeout(timeout);
    const intent = hoverIntent();
    const delay = intent ? openDelay() : closeDelay();

    if (delay <= 0) {
      setDelayedOpen(intent);
      return;
    }

    timeout = setTimeout(() => setDelayedOpen(intent), delay);
  });

  onCleanup(() => clearTimeout(timeout));

  return (
    <TooltipPrimitive
      open={delayedOpen()}
      onOpenChange={(isOpen) => setHoverIntent(isOpen)}
      forceMount
      {...rest}
    >
      {local.children}
    </TooltipPrimitive>
  );
};

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
