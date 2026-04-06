import { type Component } from "solid-js";
import type { SelectionGroup } from "../../features/selection-groups/types";
import { getStatusLabel, getStatusColor } from "../../features/sidebar/status-colors.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";

interface DetailHeaderProps {
  group: SelectionGroup;
  onBack: () => void;
}

export const DetailHeader: Component<DetailHeaderProps> = (props) => {
  const groupWithJira = () => props.group as SelectionGroupWithJira;
  const statusLabel = () => getStatusLabel(groupWithJira());
  const statusColor = () => getStatusColor(groupWithJira().jiraStatus);

  return (
    <div
      data-react-grab-detail-header
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
      <span
        class="text-[10px] px-2 py-0.5 rounded-full font-semibold"
        style={{
          background: statusColor().bg,
          color: statusColor().text,
          border: `1px solid ${statusColor().hex}`,
        }}
      >
        {statusLabel()}
      </span>
    </div>
  );
};
