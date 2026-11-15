import type { Component } from "solid-js";
import { Show } from "solid-js";
import { cn } from "../../utils/cn.js";

const VALUE_KIND_CLASSES = {
  tag: "text-code-tag",
  component: "text-code-component",
  string: "text-code-string",
};

type ValueKind = keyof typeof VALUE_KIND_CLASSES;

export interface DevInsightsFieldProps {
  label: string;
  value: string | undefined;
  kind?: ValueKind;
  /** Use monospace font for value. @default true */
  mono?: boolean;
}

export const DevInsightsField: Component<DevInsightsFieldProps> = (props) => {
  const mono = () => props.mono ?? true;
  const colorClass = () =>
    props.kind ? VALUE_KIND_CLASSES[props.kind] : "text-foreground";

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
