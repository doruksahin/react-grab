import type { Component } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";
import {
  getButtonSpacingClass,
  getHitboxConstraintClass,
} from "../../utils/toolbar-layout.js";
import { Button, type ButtonProps } from "../ui/button.js";

interface ToolbarButtonProps extends Omit<ButtonProps, "variant" | "size"> {
  vertical: boolean;
}

/**
 * An icon button in the toolbar's expandable row: the toolbar variant plus
 * the touch hitbox and the spacing that depends on the toolbar's orientation.
 */
export const ToolbarButton: Component<ToolbarButtonProps> = (props) => {
  const [local, rest] = splitProps(props, ["vertical", "class"]);
  return (
    <Button
      variant="toolbar"
      class={cn(
        "touch-hitbox",
        getButtonSpacingClass(local.vertical),
        getHitboxConstraintClass(local.vertical),
        local.class,
      )}
      {...rest}
    />
  );
};
