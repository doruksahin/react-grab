import { cva } from "cva";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";

const pinVariants = cva({
  base: "inline-flex h-7.5 max-w-60 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 text-body text-popover-foreground shadow-md transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring aria-expanded:border-selection aria-expanded:ring-1 aria-expanded:ring-selection",
});

/**
 * A one-line marker for something saved on the page (ADR-0022): a dot,
 * a short key and a few words. It toggles what it stands for; the caller
 * sets aria-expanded.
 */
const Pin: Component<ComponentProps<"button">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <button
      type="button"
      data-react-grab-pin
      class={cn(pinVariants(), local.class)}
      {...rest}
    />
  );
};

// The bold key on a pin, e.g. a ticket id.
const PinKey: Component<ComponentProps<"span">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return <span class={cn("shrink-0 font-semibold", local.class)} {...rest} />;
};

// The few words after the key; cut with an ellipsis.
const PinText: Component<ComponentProps<"span">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <span
      class={cn("min-w-0 truncate text-muted-foreground", local.class)}
      {...rest}
    />
  );
};

export { Pin, PinKey, PinText, pinVariants };
