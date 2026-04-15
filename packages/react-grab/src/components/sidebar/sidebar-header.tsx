import type { Component } from "solid-js";
import type { SyncStatus } from "../../features/sync/types";
import { APP_NAME } from "../../constants";
import { cn } from "../../utils/cn";

interface SidebarHeaderProps {
  syncStatus: SyncStatus;
  onClose: () => void;
  onInfoClick?: () => void;
  isDevMode?: boolean;
  onToggleDevMode?: () => void;
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
        {/* DEV mode toggle */}
        <div
          class="flex items-center gap-2 cursor-pointer select-none px-1 py-0.5 rounded hover:bg-foreground/[0.05]"
          onClick={() => props.onToggleDevMode?.()}
        >
          <span
            class="text-[9px] font-extrabold tracking-wider"
            classList={{
              "text-muted-foreground": !props.isDevMode,
              "text-sky-500": Boolean(props.isDevMode),
            }}
          >
            DEV
          </span>
          <div
            class="w-6 h-3.5 rounded-full relative transition-all border"
            classList={{
              "bg-foreground/10 border-foreground/20": !props.isDevMode,
              "bg-sky-500/20 border-sky-500/50": Boolean(props.isDevMode),
            }}
          >
            <div
              class="w-2.5 h-2.5 rounded-full absolute top-px transition-all"
              classList={{
                "left-px bg-muted-foreground": !props.isDevMode,
                "left-[11px] bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]": Boolean(props.isDevMode),
              }}
            />
          </div>
        </div>

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
