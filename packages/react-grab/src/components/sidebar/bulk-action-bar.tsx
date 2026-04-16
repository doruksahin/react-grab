import { type Component, Show } from "solid-js";

interface BulkActionBarProps {
  selectedCount: number;
  onMoveToGroup?: () => void;
  onCreateTicket?: () => void;
  onDelete?: () => void;
  onClearSelection?: () => void;
}

export const BulkActionBar: Component<BulkActionBarProps> = (props) => {
  return (
    <div
      data-react-grab-bulk-action-bar
      class="absolute bottom-0 left-0 right-0 bg-purple-400 text-white px-5 py-3.5 flex items-center justify-between z-10 rounded-t-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.3)] animate-in slide-in-from-bottom duration-300"
    >
      <span class="text-[13px] font-semibold">
        {props.selectedCount} selected
      </span>

      <div class="flex items-center gap-2">
        <Show when={props.onMoveToGroup}>
          <button
            class="px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors bg-white/20 hover:bg-white/30"
            onClick={() => props.onMoveToGroup?.()}
          >
            Move
          </button>
        </Show>

        <Show when={props.onCreateTicket}>
          <button
            class="px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors bg-white/20 hover:bg-white/30"
            onClick={() => props.onCreateTicket?.()}
          >
            Create ticket
          </button>
        </Show>

        <Show when={props.onDelete}>
          <button
            class="px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors bg-red-500/30 hover:bg-red-500/50 text-red-100"
            onClick={() => props.onDelete?.()}
          >
            Delete
          </button>
        </Show>

        <span
          class="ml-2 text-white/60 hover:text-white cursor-pointer text-lg"
          onClick={() => props.onClearSelection?.()}
        >
          {"\u00D7"}
        </span>
      </div>
    </div>
  );
};
