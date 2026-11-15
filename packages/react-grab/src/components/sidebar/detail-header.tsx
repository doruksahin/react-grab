import { type Component, Show, For } from "solid-js";
import type { SelectionGroup } from "../../features/selection-groups/types.js";
import {
  getStatusLabel,
  getStatusColor,
} from "../../features/sidebar/status-colors.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
import { Avatar } from "../ui/avatar.js";
import { StatusChip } from "../ui/status-chip.js";
import { IconButton } from "../ui/icon-button.js";

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
      class="flex flex-col p-3 border-b border-border shrink-0"
      style={{ "pointer-events": "auto" }}
    >
      <div class="flex items-center gap-2">
        <IconButton
          label="Back to groups list"
          class="shrink-0"
          onClick={props.onBack}
        >
          ←
        </IconButton>
        <span
          class="font-semibold text-title text-foreground flex-1 truncate"
          title={props.group.name}
        >
          {props.group.name}
        </span>
        <StatusChip size="md" label={statusLabel()} color={statusColor()} />
      </div>

      <Show when={groupWithJira().jiraTicketId}>
        <div class="flex gap-3 mt-1.5 pl-7 text-meta">
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
            <span class="flex items-center gap-1.5 text-meta text-muted-foreground">
              <Avatar
                name={groupWithJira().jiraAssignee}
                src={groupWithJira().jiraAssigneeAvatar}
                size="sm"
              />
              {groupWithJira().jiraAssignee}
            </span>
          </Show>
          <Show when={groupWithJira().jiraReporter}>
            <span class="flex items-center gap-1.5 text-meta text-muted-foreground">
              <Avatar
                name={groupWithJira().jiraReporter}
                src={groupWithJira().jiraReporterAvatar}
                size="sm"
              />
              {groupWithJira().jiraReporter}
            </span>
          </Show>
        </div>
        <Show when={groupWithJira().jiraLabels?.length}>
          <div class="flex flex-wrap gap-1 mt-1 pl-7">
            <For each={groupWithJira().jiraLabels}>
              {(lbl) => (
                <span class="text-meta px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground">
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
