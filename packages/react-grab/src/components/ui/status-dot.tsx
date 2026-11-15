import { cva, type VariantProps } from "cva";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";

const statusDotVariants = cva({
  base: "inline-block shrink-0 rounded-full",
  variants: {
    size: {
      sm: "size-1.5",
      md: "size-3",
    },
  },
  defaultVariants: {
    size: "sm",
  },
});

interface StatusDotProps
  extends
    Omit<ComponentProps<"span">, "children" | "color">,
    VariantProps<typeof statusDotVariants> {
  color: string;
}

const StatusDot: Component<StatusDotProps> = (props) => {
  const [local, rest] = splitProps(props, ["color", "size", "class"]);

  return (
    <span
      data-react-grab-status-dot
      aria-hidden="true"
      class={cn(statusDotVariants({ size: local.size }), local.class)}
      style={{ background: local.color }}
      {...rest}
    />
  );
};

export { StatusDot, statusDotVariants };
export type { StatusDotProps };
