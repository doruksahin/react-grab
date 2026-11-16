import { ToggleGroup as ToggleGroupPrimitive } from "@kobalte/core/toggle-group";
import { cva } from "cva";
import type { Component, ComponentProps } from "solid-js";
import { createContext, splitProps, useContext } from "solid-js";
import { cn } from "../../utils/cn.js";
import { Badge } from "./badge.js";

// A single-choice group of toggles (Kobalte ToggleGroup): pill chips, such
// as a filter, colour swatches, or a compact segmented control.
const toggleGroupVariants = cva({
  variants: {
    variant: {
      chip: "flex flex-wrap gap-1.5",
      swatch: "grid grid-cols-5 gap-1",
      segment: "inline-flex gap-0.5 rounded-md border border-input p-0.5",
    },
  },
  defaultVariants: {
    variant: "chip",
  },
});

const toggleGroupItemVariants = cva({
  base: "cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  variants: {
    variant: {
      chip: "group/toggle inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-input bg-transparent px-2.5 text-caption font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[pressed]:border-transparent data-[pressed]:bg-foreground data-[pressed]:text-background",
      swatch:
        "size-6 rounded-md border-2 border-transparent transition-all hover:scale-110 data-[pressed]:border-foreground",
      segment:
        "inline-flex h-5 items-center rounded-sm px-2 text-meta font-medium text-muted-foreground transition-colors hover:text-foreground data-[pressed]:bg-accent data-[pressed]:text-foreground",
    },
  },
  defaultVariants: {
    variant: "chip",
  },
});

type ToggleGroupVariant = "chip" | "swatch" | "segment";

const ToggleGroupVariantContext = createContext<() => ToggleGroupVariant>(
  (): ToggleGroupVariant => "chip",
);

// A type alias: Kobalte's polymorphic props cannot be extended by an interface.
type ToggleGroupProps = ComponentProps<typeof ToggleGroupPrimitive> & {
  variant?: ToggleGroupVariant;
};

const ToggleGroup: Component<ToggleGroupProps> = (props) => {
  const [local, rest] = splitProps(props, ["class", "variant"]);
  const variant = () => local.variant ?? "chip";
  return (
    <ToggleGroupVariantContext.Provider value={variant}>
      <ToggleGroupPrimitive
        class={cn(toggleGroupVariants({ variant: variant() }), local.class)}
        {...rest}
      />
    </ToggleGroupVariantContext.Provider>
  );
};

interface ToggleGroupItemProps extends ComponentProps<
  typeof ToggleGroupPrimitive.Item
> {
  /** The colour a swatch shows. */
  color?: string;
}

const ToggleGroupItem: Component<ToggleGroupItemProps> = (props) => {
  const [local, rest] = splitProps(props, ["class", "color"]);
  const variant = useContext(ToggleGroupVariantContext);
  return (
    <ToggleGroupPrimitive.Item
      data-react-grab-chip={variant() === "chip" ? "" : undefined}
      class={cn(toggleGroupItemVariants({ variant: variant() }), local.class)}
      style={local.color ? { background: local.color } : undefined}
      {...rest}
    />
  );
};

// A count inside a chip; it takes the pressed tone from its chip.
const ToggleGroupCount: Component<ComponentProps<"span">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <Badge
      variant="count"
      class={cn(
        "group-data-[pressed]/toggle:bg-background/10 group-data-[pressed]/toggle:text-background",
        local.class,
      )}
      {...rest}
    />
  );
};

export { ToggleGroup, ToggleGroupCount, ToggleGroupItem };
export type { ToggleGroupItemProps, ToggleGroupProps };
