import { type Component, Show } from "solid-js";
import { IconFlag } from "./icons/icon-flag.js";
import { FLAGGED_ICON_SIZE } from "../features/sidebar/resolve-display-color.js";
import { relativeTime } from "../features/sidebar/relative-time.js";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip.js";

export interface FlagIndicatorProps {
  flaggedAt?: string | null;
  flaggedBy?: string | null;
  flaggedByAvatar?: string | null;
}

function formatExactDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }) + " at " + d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Reusable flag indicator — icon + relative time + hover tooltip.
 * Used by selection-label, selection-card, and loose-selection-card.
 * Single source of truth for the flag visual (SRP/DRY).
 */
export const FlagIndicator: Component<FlagIndicatorProps> = (props) => {
  return (
    <Tooltip openDelay={200} closeDelay={300}>
      <TooltipTrigger
        as="span"
        class="inline-flex items-center justify-center gap-1 shrink-0 cursor-help rounded px-1 py-0.5 transition-colors duration-fast hover:bg-flag-hover"
      >
        <IconFlag size={FLAGGED_ICON_SIZE} class="text-flag" />
        <Show when={props.flaggedAt}>
          <span class="text-[10px] text-flag leading-none underline decoration-dotted decoration-flag/40 underline-offset-2">
            {relativeTime(new Date(props.flaggedAt!).getTime())}
          </span>
        </Show>
      </TooltipTrigger>
      <TooltipContent
        class="bg-popover text-popover-foreground border border-border rounded-lg p-0 text-xs shadow-lg w-[240px] overflow-visible"
      >
        <div class="px-3 pt-2.5 pb-2">
          <div class="flex items-center gap-1.5 mb-2">
            <IconFlag size={14} class="text-flag" />
            <span class="text-[11px] font-semibold text-flag">
              Flagged / Blocked
            </span>
          </div>
          <Show when={props.flaggedBy}>
            <div class="flex items-center gap-2 mb-1.5">
              <Show
                when={props.flaggedByAvatar}
                fallback={
                  <div class="w-6 h-6 rounded-full bg-muted shrink-0" />
                }
              >
                <img
                  src={props.flaggedByAvatar!}
                  alt=""
                  class="w-6 h-6 rounded-full shrink-0"
                />
              </Show>
              <div>
                <div class="text-[12px] font-medium text-foreground">
                  {props.flaggedBy}
                </div>
                <div class="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Flagged by
                </div>
              </div>
            </div>
          </Show>
          <Show when={props.flaggedAt}>
            <div class="flex items-center gap-2">
              <div class="w-6 shrink-0" />
              <div>
                <div class="text-[11px] text-foreground tabular-nums">
                  {formatExactDate(props.flaggedAt!)}
                </div>
                <div class="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Flagged at
                </div>
              </div>
            </div>
          </Show>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
