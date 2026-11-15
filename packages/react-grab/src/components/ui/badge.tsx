import { cva, type VariantProps } from "cva";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";

const badgeVariants = cva({
  base: "inline-flex shrink-0 items-center justify-center gap-1 rounded-full text-meta font-medium whitespace-nowrap",
  variants: {
    variant: {
      label: "px-1.5 py-0.5",
      count: "min-w-[18px] px-1.5 py-0.5 leading-none tabular-nums",
    },
    tone: {
      neutral: "bg-foreground/[0.06] text-muted-foreground",
      primary: "bg-primary text-primary-foreground font-bold",
      inverse: "bg-black text-white font-semibold",
    },
    size: {
      default: "",
      sm: "h-4 min-w-4 px-1 py-0",
      xs: "h-2.5 min-w-2.5 px-0.5 py-0",
    },
  },
  defaultVariants: {
    variant: "label",
    tone: "neutral",
    size: "default",
  },
});

interface BadgeProps
  extends
    Omit<ComponentProps<"span">, "color">,
    VariantProps<typeof badgeVariants> {}

const Badge: Component<BadgeProps> = (props) => {
  const [local, rest] = splitProps(props, ["variant", "tone", "size", "class"]);

  return (
    <span
      data-react-grab-badge
      class={cn(
        badgeVariants({
          variant: local.variant,
          tone: local.tone,
          size: local.size,
        }),
        local.class,
      )}
      {...rest}
    />
  );
};

export { Badge, badgeVariants };
export type { BadgeProps };
