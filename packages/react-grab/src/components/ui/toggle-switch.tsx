import type { Component } from "solid-js";
import { cn } from "../../utils/cn.js";

export interface ToggleSwitchProps {
  isOn: boolean;
  /** sm = toolbar size, md = sidebar/general size */
  size?: "sm" | "md";
  /** When true, uses compact vertical-edge sizing (toolbar on left/right edge) */
  vertical?: boolean;
  /** sky = sky-500 glow theme, default = foreground/muted */
  color?: "default" | "sky";
  class?: string;
}

export const ToggleSwitch: Component<ToggleSwitchProps> = (props) => {
  const size = () => props.size ?? "sm";
  const color = () => props.color ?? "default";
  const vertical = () => Boolean(props.vertical);

  return (
    <div
      class={cn(
        "relative rounded-full transition-all",
        // Track sizing
        size() === "sm" && !vertical() && "w-5 h-3",
        size() === "sm" && vertical() && "w-3.5 h-2.5",
        size() === "md" && "w-6 h-3.5 border",
        // Track color
        color() === "default" && props.isOn && "bg-popover-foreground",
        color() === "default" && !props.isOn && "bg-muted-foreground",
        color() === "sky" && props.isOn && "bg-sky-500/20 border-sky-500/50",
        color() === "sky" && !props.isOn && "bg-foreground/10 border-foreground/20",
        props.class,
      )}
    >
      <div
        class={cn(
          "absolute rounded-full transition-all",
          // Dot sizing
          size() === "sm" && !vertical() && "top-0.5 w-2 h-2",
          size() === "sm" && vertical() && "top-0.5 w-1.5 h-1.5",
          size() === "md" && "top-px w-2.5 h-2.5",
          // Dot position (off)
          !props.isOn && "left-0.5",
          // Dot position (on)
          props.isOn && size() === "sm" && !vertical() && "left-2.5",
          props.isOn && size() === "sm" && vertical() && "left-1.5",
          props.isOn && size() === "md" && "left-[11px]",
          // Dot color
          color() === "default" && "bg-popover",
          color() === "sky" && props.isOn && "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]",
          color() === "sky" && !props.isOn && "bg-muted-foreground",
        )}
      />
    </div>
  );
};
