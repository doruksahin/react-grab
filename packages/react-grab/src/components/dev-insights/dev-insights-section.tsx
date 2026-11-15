import type { Component, JSX } from "solid-js";
import { Show } from "solid-js";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "../ui/collapsible.jsx";
import { ChevronIcon } from "../ui/chevron-icon.jsx";

export interface DevInsightsSectionProps {
  label: string;
  /** Count badge shown next to the label. */
  count?: number;
  /** Start expanded. @default false */
  defaultOpen?: boolean;
  children: JSX.Element;
}

export const DevInsightsSection: Component<DevInsightsSectionProps> = (
  props,
) => {
  return (
    <>
      <div class="h-px bg-border my-1" />
      <Collapsible defaultOpen={props.defaultOpen ?? false}>
        <CollapsibleTrigger class="flex w-full items-center gap-1.5 py-0.5 cursor-pointer select-none text-meta text-muted-foreground font-medium [&>svg.collapsible-chevron]:transition-transform [&>svg.collapsible-chevron]:duration-150 [&[data-expanded]>svg.collapsible-chevron]:rotate-0 [&[data-closed]>svg.collapsible-chevron]:-rotate-90">
          <ChevronIcon class="collapsible-chevron text-muted-foreground size-2.5" />
          {props.label}
          <Show when={props.count !== undefined}>
            <span class="bg-border text-muted-foreground px-[5px] rounded-[3px] text-meta font-semibold">
              {props.count}
            </span>
          </Show>
        </CollapsibleTrigger>
        <CollapsibleContent class="overflow-hidden">
          <div class="mt-0.5 ml-1 pl-2 border-l border-border">
            {props.children}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
};
