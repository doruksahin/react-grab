import type { Component, ComponentProps, JSX } from "solid-js";
import { splitProps } from "solid-js";
import type { VariantProps } from "cva";
import { ICON_BUTTON_TOOLTIP_OPEN_DELAY_MS } from "../../constants.js";
import { cn } from "../../utils/cn.js";
import { buttonVariants } from "./button.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip.js";

interface IconButtonProps
  extends
    Omit<ComponentProps<"button">, "children" | "aria-label">,
    VariantProps<typeof buttonVariants> {
  label: string;
  children: JSX.Element;
}

const IconButton: Component<IconButtonProps> = (props) => {
  const [local, rest] = splitProps(props, [
    "label",
    "children",
    "class",
    "variant",
    "size",
  ]);

  return (
    <Tooltip openDelay={ICON_BUTTON_TOOLTIP_OPEN_DELAY_MS}>
      <TooltipTrigger
        data-react-grab-icon-button
        aria-label={local.label}
        class={cn(
          buttonVariants({
            variant: local.variant ?? "subtle",
            size: local.size ?? "icon-sm",
          }),
          local.class,
        )}
        {...rest}
      >
        {local.children}
      </TooltipTrigger>
      <TooltipContent>{local.label}</TooltipContent>
    </Tooltip>
  );
};

export { IconButton };
export type { IconButtonProps };
