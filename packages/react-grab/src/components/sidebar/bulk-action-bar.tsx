import type { Component, JSX } from "solid-js";
import { IconButton } from "../ui/icon-button.js";

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
      class="absolute bottom-0 left-0 right-0 bg-bulk-bar text-bulk-bar-foreground px-5 py-3.5 flex items-center justify-between z-10 shadow-bulk-bar animate-in slide-in-from-bottom duration-300"
    >
      <span class="text-body font-semibold">
        {props.selectedCount} selected
      </span>

      <div class="flex items-center gap-2">
        {props.actions}

        <IconButton
          label="Clear selection"
          variant="bulk"
          class="ml-2"
          onClick={() => props.onClearSelection?.()}
        >
          {"\u00D7"}
        </IconButton>
      </div>
    </div>
  );
};
