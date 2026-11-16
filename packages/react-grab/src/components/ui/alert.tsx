import { Alert as AlertPrimitive } from "@kobalte/core/alert";
import { cva, type VariantProps } from "cva";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";

const alertVariants = cva({
  base: "flex rounded-lg border font-normal text-foreground",
  variants: {
    tone: {
      warning: "border-warning/35 bg-warning/12 [&_svg]:text-warning-text",
      success: "border-success/35 bg-success/12 [&_svg]:text-success-text",
      neutral: "border-border bg-muted [&_svg]:text-muted-foreground",
    },
    size: {
      default: "gap-2.5 p-3 text-body leading-5",
      sm: "gap-2 p-2.5 text-caption leading-4",
    },
  },
  defaultVariants: {
    tone: "warning",
    size: "default",
  },
});

interface AlertProps
  extends
    ComponentProps<typeof AlertPrimitive>,
    VariantProps<typeof alertVariants> {}

// An inline message about the state of the app (Kobalte Alert, role="alert").
const Alert: Component<AlertProps> = (props) => {
  const [local, rest] = splitProps(props, ["class", "tone", "size"]);
  return (
    <AlertPrimitive
      class={cn(
        alertVariants({ tone: local.tone, size: local.size }),
        local.class,
      )}
      {...rest}
    />
  );
};

export { Alert, alertVariants };
export type { AlertProps };
