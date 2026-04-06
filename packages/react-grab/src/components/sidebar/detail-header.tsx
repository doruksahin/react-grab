import { type Component, Show, For } from "solid-js";
import type { SelectionGroup } from "../../features/selection-groups/types";
import { getStatusLabel, getStatusColor } from "../../features/sidebar/status-colors.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
import { UserAvatar } from "./UserAvatar.js";

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
      class="flex flex-col p-3 border-b border-white/10 shrink-0"
      style={{ "pointer-events": "auto" }}
    >
      <div class="flex items-center gap-2">
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
          class="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0"
          style={{
            background: statusColor().bg,
            color: statusColor().text,
            border: `1px solid ${statusColor().hex}`,
          }}
        >
          {statusLabel()}
        </span>
      </div>

      <Show when={groupWithJira().jiraTicketId}>
        <div class="flex gap-3 mt-1.5 pl-7 text-[11px]">
          <a
            href={groupWithJira().jiraUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            class="text-blue-400 hover:text-blue-300 transition-colors font-semibold"
            style={{ "pointer-events": "auto" }}
          >
            {groupWithJira().jiraTicketId}
          </a>
          <Show when={groupWithJira().jiraAssignee}>
            <span class="flex items-center gap-1.5 text-[10px] text-white/50">
              <UserAvatar
                avatarUrl={groupWithJira().jiraAssigneeAvatar}
                displayName={groupWithJira().jiraAssignee}
                size={16}
              />
              {groupWithJira().jiraAssignee}
            </span>
          </Show>
          <Show when={groupWithJira().jiraReporter}>
            <span class="flex items-center gap-1.5 text-[10px] text-white/30">
              <UserAvatar
                avatarUrl={groupWithJira().jiraReporterAvatar}
                displayName={groupWithJira().jiraReporter}
                size={16}
              />
              {groupWithJira().jiraReporter}
            </span>
          </Show>
        </div>
        <Show when={groupWithJira().jiraLabels?.length}>
          <div class="flex flex-wrap gap-1 mt-1 pl-7">
            <For each={groupWithJira().jiraLabels}>
              {(lbl) => (
                <span class="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">
                  {lbl}
                </span>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
};
