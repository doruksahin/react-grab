import type { Component } from "solid-js";
import { Show } from "solid-js";
import { cn } from "../../utils/cn.js";

const VALUE_COLORS = {
  green: "text-code-green",
  purple: "text-code-purple",
  amber: "text-code-amber",
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
  const colorClass = () =>
    props.color ? VALUE_COLORS[props.color] : "text-foreground";

  return (
    <Show when={props.value}>
      <div class="flex gap-2 items-baseline py-px">
        <span class="text-meta text-muted-foreground font-medium min-w-[36px] shrink-0">
          {props.label}
        </span>
        <span
          class={cn(
            "text-meta leading-relaxed break-all",
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
