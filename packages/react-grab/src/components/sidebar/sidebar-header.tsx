import type { Component } from "solid-js";
import type { SyncStatus } from "../../features/sync/types";
import { cn } from "../../utils/cn";

interface SidebarHeaderProps {
  syncStatus: SyncStatus;
  onClose: () => void;
}

export const SidebarHeader: Component<SidebarHeaderProps> = (props) => {
  return (
    <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
      <h2 class="flex items-center gap-2 text-sm font-semibold text-white">
        <span
          class={cn(
            "w-2 h-2 rounded-full",
            props.syncStatus === "synced"
              ? "bg-green-500"
              : props.syncStatus === "error"
                ? "bg-red-500"
                : "bg-white/30",
          )}
        />
        react-grab
      </h2>
      <button
        class="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded cursor-pointer"
        onClick={props.onClose}
        aria-label="Close sidebar"
      >
        &times;
      </button>
    </div>
  );
};
