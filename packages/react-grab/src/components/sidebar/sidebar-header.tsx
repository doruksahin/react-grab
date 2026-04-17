import type { Component } from "solid-js";
import type { SyncStatus } from "../../features/sync/types";
import { APP_NAME } from "../../constants";
import { cn } from "../../utils/cn";

interface SidebarHeaderProps {
  syncStatus: SyncStatus;
  onClose: () => void;
  onInfoClick?: () => void;
}

export const SidebarHeader: Component<SidebarHeaderProps> = (props) => {
  return (
    <div data-react-grab-sidebar-header class="flex items-center justify-between px-4 py-3 border-b border-border">
      <h2 class="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span
          class={cn(
            "w-2 h-2 rounded-full",
            props.syncStatus === "synced"
              ? "bg-green-500"
              : props.syncStatus === "error"
                ? "bg-red-500"
                : "bg-muted-foreground",
          )}
        />
        {APP_NAME}
      </h2>
      <div class="flex items-center gap-1.5">
        <button
          class="w-6 h-6 rounded-full border border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-border cursor-pointer flex items-center justify-center"
          onClick={() => props.onInfoClick?.()}
          title="Status legend"
        >
          i
        </button>
        <button
          class="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded cursor-pointer"
          onClick={props.onClose}
          aria-label="Close sidebar"
        >
          &times;
        </button>
      </div>
    </div>
  );
};
