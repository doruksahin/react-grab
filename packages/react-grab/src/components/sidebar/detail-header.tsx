import { type Component } from "solid-js";
import type { SelectionGroup } from "../../features/selection-groups/types";
import type { GroupedEntry } from "../../features/sidebar";
import { deriveStatus } from "../../features/sidebar";
import { StatusBadge } from "./status-badge";

interface DetailHeaderProps {
  group: SelectionGroup;
  onBack: () => void;
}

export const DetailHeader: Component<DetailHeaderProps> = (props) => {
  // deriveStatus needs a GroupedEntry; construct a minimal one for the header badge
  const status = () =>
    deriveStatus({ group: props.group, items: [] } as GroupedEntry);

  return (
    <div
      class="flex items-center gap-2 p-3 border-b border-white/10 shrink-0"
      style={{ "pointer-events": "auto" }}
    >
      <button
        class="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors shrink-0"
        onClick={props.onBack}
        aria-label="Back to groups list"
      >
        ←
      </button>
      <span
        class="font-semibold text-[14px] text-white flex-1 truncate"
        title={props.group.name}
      >
        {props.group.name}
      </span>
      <StatusBadge status={status()} />
    </div>
  );
};
