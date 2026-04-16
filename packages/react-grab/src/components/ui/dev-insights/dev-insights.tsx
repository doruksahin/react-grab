import type { Component, JSX } from "solid-js";
import { cn } from "../../../utils/cn.js";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "../collapsible.jsx";
import { ChevronIcon } from "../chevron-icon.jsx";

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
        class="bg-[#0a0e14] border border-[#1c2433] rounded-lg overflow-hidden"
      >
        {/* Header bar — clickable trigger inside the card */}
        <CollapsibleTrigger
          class={cn(
            "flex w-full items-center gap-1.5 px-2.5 py-1.5 cursor-pointer select-none transition-colors",
            "bg-[#0d1117] border-b border-[#1c2433]",
            "[&>svg.collapsible-chevron]:transition-transform [&>svg.collapsible-chevron]:duration-150",
            "[&[data-expanded]>svg.collapsible-chevron]:rotate-0",
            "[&[data-closed]>svg.collapsible-chevron]:-rotate-90",
          )}
        >
          <ChevronIcon class="collapsible-chevron text-[#445] size-2.5" />
          <span class="w-[5px] h-[5px] rounded-full bg-sky-500 shadow-[0_0_6px_#38bdf820]" />
          <span class="text-[9px] font-extrabold text-sky-500 uppercase tracking-wide">
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
