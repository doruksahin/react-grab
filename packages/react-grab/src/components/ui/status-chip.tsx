import { cva, type VariantProps } from "cva";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";
import { StatusDot } from "./status-dot.js";

interface ChipColor {
  hex: string;
  bg: string;
  text: string;
}

const statusChipVariants = cva({
  base: "inline-flex shrink-0 items-center rounded-full font-medium leading-none whitespace-nowrap",
  variants: {
    size: {
      sm: "gap-1 px-1.5 py-0.5 text-meta",
      md: "gap-1.5 px-2 py-1 text-meta",
    },
  },
  defaultVariants: {
    size: "sm",
  },
});

interface StatusChipProps
  extends
    Omit<ComponentProps<"span">, "children" | "color">,
    VariantProps<typeof statusChipVariants> {
  label: string;
  color: ChipColor;
}

const StatusChip: Component<StatusChipProps> = (props) => {
  const [local, rest] = splitProps(props, ["label", "color", "size", "class"]);

  return (
    <span
      data-react-grab-status-chip
      class={cn(statusChipVariants({ size: local.size }), local.class)}
      style={{ background: local.color.bg, color: local.color.text }}
      {...rest}
    >
      <StatusDot color={local.color.hex} />
      {local.label}
    </span>
  );
};

export { StatusChip, statusChipVariants };
export type { ChipColor, StatusChipProps };
