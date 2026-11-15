import type { Component } from "solid-js";
import type { ArrowProps } from "../../types.js";
import { getArrowSize } from "../../utils/get-arrow-size.js";

export const Arrow: Component<ArrowProps> = (props) => {
  // The arrow is the visual continuation of a `bg-popover` panel, so it
  // reads from the same shadcn token and flips automatically with the theme.
  const arrowColor = "var(--popover)";
  const isBottom = () => props.position === "bottom";
  const arrowSize = () => getArrowSize(props.labelWidth ?? 0);

  return (
    <div
      ref={props.ref}
      data-react-grab-arrow
      class="absolute w-0 h-0 z-10"
      style={{
        left: `${props.left ?? 0}px`,
        top: isBottom() ? "0" : undefined,
        bottom: isBottom() ? undefined : "0",
        transform: isBottom() ? "translateY(-100%)" : "translateY(100%)",
        "border-left": `${arrowSize()}px solid transparent`,
        "border-right": `${arrowSize()}px solid transparent`,
        "border-bottom": isBottom()
          ? `${arrowSize()}px solid ${arrowColor}`
          : undefined,
        "border-top": isBottom()
          ? undefined
          : `${arrowSize()}px solid ${arrowColor}`,
      }}
    />
  );
};
