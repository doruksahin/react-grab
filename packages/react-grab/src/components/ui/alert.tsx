import { Alert as AlertPrimitive } from "@kobalte/core/alert";
import { cva, type VariantProps } from "cva";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";

const alertVariants = cva({
  base: "flex gap-2.5 rounded-lg border p-3 text-body leading-5 font-normal text-foreground",
  variants: {
    tone: {
      warning: "border-warning/35 bg-warning/12 [&_svg]:text-warning-text",
    },
  },
  defaultVariants: {
    tone: "warning",
  },
});

interface AlertProps
  extends
    ComponentProps<typeof AlertPrimitive>,
    VariantProps<typeof alertVariants> {}

// An inline message about the state of the app (Kobalte Alert, role="alert").
const Alert: Component<AlertProps> = (props) => {
  const [local, rest] = splitProps(props, ["class", "tone"]);
  return (
    <AlertPrimitive
      class={cn(alertVariants({ tone: local.tone }), local.class)}
      {...rest}
    />
  );
};

export { Alert, alertVariants };
export type { AlertProps };
