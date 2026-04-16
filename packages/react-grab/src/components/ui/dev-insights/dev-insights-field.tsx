import type { Component } from "solid-js";
import { Show } from "solid-js";
import { cn } from "../../../utils/cn.js";

const VALUE_COLORS = {
  green: "text-emerald-400",
  purple: "text-purple-400",
  amber: "text-amber-400",
} as const;

type ValueColor = keyof typeof VALUE_COLORS;

export interface DevInsightsFieldProps {
  label: string;
  value: string | undefined;
  color?: ValueColor;
  /** Use monospace font for value. @default true */
  mono?: boolean;
}

export const DevInsightsField: Component<DevInsightsFieldProps> = (props) => {
  const mono = () => props.mono ?? true;
  const colorClass = () => (props.color ? VALUE_COLORS[props.color] : "text-[#cbd5e1]");

  return (
    <Show when={props.value}>
      <div class="flex gap-2 items-baseline py-px">
        <span class="text-[9px] text-[#4a5568] font-medium min-w-[36px] shrink-0">
          {props.label}
        </span>
        <span
          class={cn(
            "text-[10px] leading-relaxed break-all",
            mono() && "font-mono",
            colorClass(),
          )}
        >
          {props.value}
        </span>
      </div>
    </Show>
  );
};
