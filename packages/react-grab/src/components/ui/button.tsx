import { cva, type VariantProps } from "cva";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";

const buttonVariantDefinitions = {
  base: "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
      destructive:
        "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
      outline:
        "border border-input bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground aria-pressed:bg-accent aria-pressed:text-accent-foreground",
      secondary:
        "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
      ghost:
        "text-foreground hover:bg-accent hover:text-accent-foreground aria-pressed:bg-accent aria-pressed:text-accent-foreground",
      subtle:
        "text-muted-foreground hover:bg-accent hover:text-foreground aria-pressed:bg-accent aria-pressed:text-foreground",
      link: "text-primary underline-offset-4 hover:underline",
      chip: "contain-layout border-solid border-border bg-popover text-popover-foreground transition-all [border-width:0.5px] hover:bg-accent press-scale",
      "chip-destructive":
        "contain-layout bg-destructive/10 text-destructive transition-all hover:bg-destructive/20 press-scale",
      inverse:
        "contain-layout bg-popover-foreground text-popover interactive-scale",
      toolbar: "contain-layout flex bg-transparent interactive-scale",
      "menu-item":
        "relative z-1 contain-layout w-full justify-start bg-transparent text-left",
      segment:
        "border border-border bg-accent/50 text-muted-foreground hover:bg-accent/70 aria-pressed:bg-accent aria-pressed:text-foreground aria-pressed:inset-shadow-tab",
      swatch:
        "border-2 border-transparent transition-all hover:scale-110 aria-pressed:border-foreground",
      bulk: "bg-bulk-bar-foreground/20 text-bulk-bar-foreground hover:bg-bulk-bar-foreground/30",
      floating:
        "contain-layout border border-border bg-popover shadow-md transition-all hover:scale-105 hover:border-ring hover:bg-accent hover:shadow-lg",
    },
    size: {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      xs: "h-6 gap-1 rounded-md px-2 text-meta",
      lg: "h-10 rounded-md px-8",
      chip: "h-[17px] gap-1 rounded-sm px-[3px] py-px text-body leading-3.5",
      menu: "rounded-none px-2 py-1",
      segment:
        "flex-1 gap-1.5 rounded-none px-2 py-1.5 text-meta font-semibold",
      icon: "h-9 w-9",
      "icon-md": "size-7 rounded-md",
      "icon-sm": "size-6 rounded-md",
      "icon-xs": "size-5 rounded-md",
      "icon-2xs": "size-4 rounded-full",
      auto: "",
    },
  },
};

const buttonVariants = cva({
  ...buttonVariantDefinitions,
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

interface ButtonProps
  extends
    Omit<ComponentProps<"button">, "size">,
    VariantProps<typeof buttonVariants> {}

const Button: Component<ButtonProps> = (props) => {
  const [local, rest] = splitProps(props, ["class", "variant", "size"]);
  return (
    <button
      class={cn(
        buttonVariants({ variant: local.variant, size: local.size }),
        local.class,
      )}
      {...rest}
    />
  );
};

export { Button, buttonVariantDefinitions, buttonVariants };
export type { ButtonProps };
