import type { Component } from "solid-js";
import { cn } from "../../utils/cn.js";

interface ChevronIconProps {
  size?: number;
  class?: string;
}

export const ChevronIcon: Component<ChevronIconProps> = (props) => {
  return (
    <svg
      width={props.size ?? 12}
      height={props.size ?? 12}
      viewBox="0 0 16 16"
      class={cn("shrink-0", props.class)}
    >
      <path
        fill="currentColor"
        d="m14.53 6.03-6 6a.75.75 0 0 1-1.004.052l-.056-.052-6-6 1.06-1.06L8 10.44l5.47-5.47z"
      />
    </svg>
  );
};
