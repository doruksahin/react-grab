import type { Component, JSX } from "solid-js";
import { cn } from "../../utils/cn.js";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "../ui/collapsible.jsx";
import { ChevronIcon } from "../ui/chevron-icon.jsx";

export interface DevInsightsShellProps {
  children: JSX.Element;
  /** Start expanded. @default false */
  defaultOpen?: boolean;
  /** Additional class on the outer wrapper. */
  class?: string;
}

export const DevInsightsShell: Component<DevInsightsShellProps> = (props) => {
  return (
    <Collapsible
      defaultOpen={props.defaultOpen ?? false}
      class={cn("mt-1.5 w-full", props.class)}
    >
      <div
        data-react-grab-dev-insights
        class="bg-background border border-border rounded-lg overflow-hidden"
      >
        {/* Header bar — clickable trigger inside the card */}
        <CollapsibleTrigger
          class={cn(
            "flex w-full items-center gap-1.5 px-2.5 py-1.5 cursor-pointer select-none transition-colors",
            "bg-card border-b border-border",
            "[&>svg.collapsible-chevron]:transition-transform [&>svg.collapsible-chevron]:duration-150",
            "[&[data-expanded]>svg.collapsible-chevron]:rotate-0",
            "[&[data-closed]>svg.collapsible-chevron]:-rotate-90",
          )}
        >
          <ChevronIcon class="collapsible-chevron text-muted-foreground size-2.5" />
          <span class="w-[5px] h-[5px] rounded-full bg-dev shadow-glow-dev-soft" />
          <span class="text-meta font-extrabold text-dev uppercase tracking-wide">
            Dev Insights
          </span>
        </CollapsibleTrigger>

        {/* Body — collapses */}
        <CollapsibleContent class="overflow-hidden">
          <div class="px-2.5 py-2 font-mono flex flex-col gap-px">
            {props.children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
