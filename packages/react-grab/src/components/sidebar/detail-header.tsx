import { type Component, Show, For } from "solid-js";
import { getStatusChip } from "../../features/sidebar/get-status-chip.js";
import type { SelectionGroupWithJira } from "../../features/selection-groups/types.js";
import { Avatar } from "../ui/avatar.js";
import { StatusChip } from "../ui/status-chip.js";
import { IconButton } from "../ui/icon-button.js";
import { Badge } from "../ui/badge.js";

interface DetailHeaderProps {
  group: SelectionGroupWithJira;
  onBack: () => void;
}

export const DetailHeader: Component<DetailHeaderProps> = (props) => {
  const statusChip = () => getStatusChip(props.group);

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
        <StatusChip size="md" {...statusChip()} />
      </div>

      <Show when={props.group.jiraTicketId}>
        <div class="flex gap-3 mt-1.5 pl-7 text-meta">
          <a
            href={props.group.jiraUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            class="text-link hover:text-link-hover transition-colors font-semibold"
            style={{ "pointer-events": "auto" }}
          >
            {props.group.jiraTicketId}
          </a>
          <Show when={props.group.jiraAssignee}>
            <span class="flex items-center gap-1.5 text-meta text-muted-foreground">
              <Avatar
                name={props.group.jiraAssignee}
                src={props.group.jiraAssigneeAvatar}
                size="sm"
              />
              {props.group.jiraAssignee}
            </span>
          </Show>
          <Show when={props.group.jiraReporter}>
            <span class="flex items-center gap-1.5 text-meta text-muted-foreground">
              <Avatar
                name={props.group.jiraReporter}
                src={props.group.jiraReporterAvatar}
                size="sm"
              />
              {props.group.jiraReporter}
            </span>
          </Show>
        </div>
        <Show when={props.group.jiraLabels?.length}>
          <div class="flex flex-wrap gap-1 mt-1 pl-7">
            <For each={props.group.jiraLabels}>
              {(lbl) => <Badge>{lbl}</Badge>}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
};
