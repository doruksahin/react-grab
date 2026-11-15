import type { Component } from "solid-js";
import type { SyncStatus } from "../../features/sync/types.js";
import { APP_NAME } from "../../constants.js";
import { cn } from "../../utils/cn.js";
import { IconButton } from "../ui/icon-button.js";

interface SidebarHeaderProps {
  syncStatus: SyncStatus;
  onClose: () => void;
  onInfoClick?: () => void;
}

export const SidebarHeader: Component<SidebarHeaderProps> = (props) => {
  return (
    <div
      data-react-grab-sidebar-header
      class="flex items-center justify-between px-4 py-3 border-b border-border"
    >
      <h2 class="flex items-center gap-2 text-title leading-5 font-semibold text-foreground">
        <span
          class={cn(
            "w-2 h-2 rounded-full",
            props.syncStatus === "synced"
              ? "bg-success"
              : props.syncStatus === "error"
                ? "bg-danger"
                : "bg-muted-foreground",
          )}
        />
        {APP_NAME}
      </h2>
      <div class="flex items-center gap-1.5">
        <IconButton
          label="Status legend"
          variant="outline"
          class="rounded-full text-meta"
          onClick={() => props.onInfoClick?.()}
        >
          i
        </IconButton>
        <IconButton label="Close sidebar" onClick={props.onClose}>
          &times;
        </IconButton>
      </div>
    </div>
  );
};
