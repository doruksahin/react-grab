import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import { composeEventHandlers } from "@kobalte/utils";
import {
  Tooltip as TooltipPrimitive,
  type TooltipTriggerProps,
} from "@kobalte/core/tooltip";
import type { Component, ComponentProps, ValidComponent } from "solid-js";
import {
  createContext,
  createEffect,
  createSignal,
  mergeProps,
  onCleanup,
  Show,
  splitProps,
  useContext,
} from "solid-js";
import { cn } from "../../utils/cn.js";
import { isKeyboardFocus } from "../../utils/is-keyboard-focus.js";
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

// With forceMount Kobalte would keep the content mounted while closed, and
// start positioning it while the trigger is still detached. The content
// renders only while this delayed open state is true.
const DelayedOpenContext = createContext<() => boolean>();

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
    <DelayedOpenContext.Provider value={delayedOpen}>
      <TooltipPrimitive
        open={delayedOpen()}
        onOpenChange={(isOpen) => setHoverIntent(isOpen)}
        forceMount
        {...rest}
      >
        {local.children}
      </TooltipPrimitive>
    </DelayedOpenContext.Provider>
  );
};

// A tooltip opens on hover and on keyboard focus, not when a dialog or focus
// trap moves focus to the trigger by script (WAI-ARIA tooltip pattern).
// Kobalte skips opening when the focus event is default-prevented.
const preventScriptFocusOpen = (event: FocusEvent) => {
  if (!isKeyboardFocus(event)) event.preventDefault();
};

const TooltipTrigger = <T extends ValidComponent = "button">(
  props: PolymorphicProps<T, TooltipTriggerProps<T>>,
) => (
  <TooltipPrimitive.Trigger<T>
    {...mergeProps(props, {
      onFocus: composeEventHandlers([props.onFocus, preventScriptFocusOpen]),
    })}
  />
);

const TooltipPortal: Component<
  ComponentProps<typeof TooltipPrimitive.Portal>
> = (props) => {
  return <TooltipPrimitive.Portal {...props} mount={useShadowMount()} />;
};

const TooltipContent: Component<
  ComponentProps<typeof TooltipPrimitive.Content>
> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  const delayedOpen = useContext(DelayedOpenContext);
  return (
    <Show when={delayedOpen?.() ?? true}>
      <TooltipPortal>
        <TooltipPrimitive.Content
          class={cn(
            "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-caption leading-4 text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95",
            local.class,
          )}
          {...rest}
        />
      </TooltipPortal>
    </Show>
  );
};

export { Tooltip, TooltipTrigger, TooltipPortal, TooltipContent };
