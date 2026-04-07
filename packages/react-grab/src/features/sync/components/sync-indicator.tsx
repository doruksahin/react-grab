import type { Component } from "solid-js";
import type { SyncStatus } from "../types.js";
import { cn } from "../../../utils/cn.js";

interface SyncIndicatorProps {
  status: SyncStatus;
  workspace?: string;
}

const DOT_COLOR: Record<SyncStatus, string> = {
  local: "bg-[#9ca3af]",
  synced: "bg-[#22c55e]",
  error: "bg-[#ef4444]",
};

const LABEL: Record<SyncStatus, string> = {
  local: "Local storage",
  synced: "Synced",
  error: "Sync error",
};

export const SyncIndicator: Component<SyncIndicatorProps> = (props) => {
  const dotClass = () => DOT_COLOR[props.status];
  const label = () =>
    props.status === "synced" && props.workspace
      ? `Synced · ${props.workspace}`
      : LABEL[props.status];

  return (
    <div
      class="relative shrink-0 group/sync"
      data-react-grab-ignore-events
    >
      <div class={cn("w-[6px] h-[6px] rounded-full transition-colors", dotClass())} />
      <div class="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[11px] px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover/sync:opacity-100 transition-opacity border border-border">
        <span class={cn("inline-block w-[6px] h-[6px] rounded-full mr-1.5 align-middle", dotClass())} />
        {label()}
      </div>
    </div>
  );
};
