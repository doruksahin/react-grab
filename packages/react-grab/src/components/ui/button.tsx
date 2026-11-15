import { cva, type VariantProps } from "cva";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";

const BUTTON_BASE_CLASS =
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-title leading-5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

const buttonVariantOptions = {
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
    chip: "contain-layout border-solid border-border bg-popover text-popover-foreground transition-all [border-width:0.5px] hover:bg-accent press-scale",
    "chip-destructive":
      "contain-layout bg-destructive/10 text-destructive transition-all hover:bg-destructive/20 press-scale",
    inverse:
      "contain-layout bg-popover-foreground text-popover interactive-scale",
    toolbar: "contain-layout flex bg-transparent interactive-scale",
    bulk: "bg-bulk-bar-foreground/20 text-bulk-bar-foreground hover:bg-bulk-bar-foreground/30",
  },
  size: {
    default: "h-9 px-4 py-2",
    sm: "h-8 rounded-md px-3 text-caption leading-4",
    xs: "h-6 gap-1 rounded-md px-2 text-meta",
    lg: "h-10 rounded-md px-8",
    icon: "h-9 w-9",
    "icon-md": "size-7 rounded-md",
    "icon-sm": "size-6 rounded-md",
    "icon-xs": "size-5 rounded-md",
    "icon-2xs": "size-4 rounded-full",
  },
};

type ButtonVariantName = keyof typeof buttonVariantOptions.variant;
type ButtonSizeName = keyof typeof buttonVariantOptions.size;

// Chips and toolbar buttons come with their own size: on the default size the
// variant applies it, so callers only name the variant.
const CHIP_SIZE_CLASS =
  "h-[17px] gap-1 rounded-sm px-[3px] py-px text-body leading-3.5";

const createButtonVariants = (defaultVariants: {
  variant: ButtonVariantName;
  size: ButtonSizeName;
}) =>
  cva({
    base: BUTTON_BASE_CLASS,
    variants: buttonVariantOptions,
    compoundVariants: [
      { variant: "chip", size: "default", class: CHIP_SIZE_CLASS },
      { variant: "chip-destructive", size: "default", class: CHIP_SIZE_CLASS },
      { variant: "toolbar", size: "default", class: "h-auto p-0" },
    ],
    defaultVariants,
  });

const buttonVariants = createButtonVariants({
  variant: "default",
  size: "default",
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

export { Button, buttonVariants, createButtonVariants };
export type { ButtonProps };
