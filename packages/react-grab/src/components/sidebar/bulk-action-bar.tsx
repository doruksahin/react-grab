import type { Component, JSX } from "solid-js";

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection?: () => void;
  /** Slot for action buttons rendered between count and close button */
  actions?: JSX.Element;
}

export const BulkActionBar: Component<BulkActionBarProps> = (props) => {
  return (
    <div
      data-react-grab-bulk-action-bar
      class="absolute bottom-0 left-0 right-0 bg-bulk-bar text-bulk-bar-foreground px-5 py-3.5 flex items-center justify-between z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] animate-in slide-in-from-bottom duration-300"
    >
      <span class="text-[13px] font-semibold">
        {props.selectedCount} selected
      </span>

      <div class="flex items-center gap-2">
        {props.actions}

        <span
          class="ml-2 text-bulk-bar-foreground/60 hover:text-bulk-bar-foreground cursor-pointer text-lg"
          onClick={() => props.onClearSelection?.()}
        >
          {"\u00D7"}
        </span>
      </div>
    </div>
  );
};
