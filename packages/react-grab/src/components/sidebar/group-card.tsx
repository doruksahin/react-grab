import { type Component, For, Show } from "solid-js";
import type { GroupedEntry } from "../../features/sidebar";
import { relativeTime } from "../../features/sidebar";
import { getStatusColor, getStatusLabel } from "../../features/sidebar/status-colors.js";
import { UserAvatar } from "./UserAvatar.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";

interface GroupCardProps {
  entry: GroupedEntry;
  onClick: (groupId: string, cardEl: HTMLElement) => void;
}

export const GroupCard: Component<GroupCardProps> = (props) => {
  const statusLabel = () => getStatusLabel(props.entry.group);
  const statusColor = () => getStatusColor(props.entry.group.jiraStatus);
  const comments = () => props.entry.items;

  return (
    <div
      data-react-grab-group-card
      class="bg-[#232323] rounded-lg p-3 mb-1.5 cursor-pointer border border-transparent hover:border-white/10 hover:bg-[#2a2a2a] transition-colors"
      style={{ "border-left": `2px solid ${statusColor().hex}` }}
      onClick={(e) => props.onClick(props.entry.group.id, e.currentTarget as HTMLElement)}
    >
      <div class="flex items-center justify-between mb-1.5">
        <span class="font-semibold text-[13px] text-white">{props.entry.group.name}</span>
        <span
          class="text-[10px] px-1.5 py-0.5 rounded"
          style={{
            background: statusColor().bg,
            color: statusColor().text,
          }}
        >
          {statusLabel()}
        </span>
      </div>

      <div class="flex gap-3 text-[11px] text-white/40 mb-2">
        <span>{comments().length} selections</span>
        <span>{relativeTime(props.entry.group.createdAt)}</span>
        <Show when={props.entry.group.jiraTicketId}>
          <span class="text-blue-400">
            {props.entry.group.jiraTicketId}
          </span>
        </Show>
      </div>

      <Show when={props.entry.group.jiraAssignee || props.entry.group.jiraReporter}>
        <div class="flex gap-3 text-[11px] mb-2">
          <Show when={props.entry.group.jiraAssignee}>
            <span class="flex items-center gap-1.5 text-[10px] text-white/50">
              <UserAvatar
                avatarUrl={(props.entry.group as SelectionGroupWithJira).jiraAssigneeAvatar}
                displayName={props.entry.group.jiraAssignee}
                size={16}
              />
              {props.entry.group.jiraAssignee}
            </span>
          </Show>
          <Show when={props.entry.group.jiraReporter}>
            <span class="flex items-center gap-1.5 text-[10px] text-white/30">
              <UserAvatar
                avatarUrl={(props.entry.group as SelectionGroupWithJira).jiraReporterAvatar}
                displayName={props.entry.group.jiraReporter}
                size={16}
              />
              {props.entry.group.jiraReporter}
            </span>
          </Show>
        </div>
      </Show>

      <Show when={props.entry.group.jiraLabels?.length}>
        <div class="flex flex-wrap gap-1 mb-2">
          <For each={props.entry.group.jiraLabels}>
            {(lbl) => (
              <span class="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">
                {lbl}
              </span>
            )}
          </For>
        </div>
      </Show>

      <div class="flex flex-col gap-1">
        <For each={comments().slice(0, 3)}>
          {(comment) => (
            <div class="flex items-center gap-1.5 text-[10px]">
              <span class="px-1.5 py-0.5 rounded bg-white/5 text-white/60">
                {comment.componentName || comment.elementName}
              </span>
              <span class="px-1.5 py-0.5 rounded bg-white/5 text-white/30">
                {comment.tagName}
              </span>
              <Show when={comment.commentText}>
                <span class="text-white/30 italic truncate max-w-[150px]">
                  {comment.commentText}
                </span>
              </Show>
            </div>
          )}
        </For>
        <Show when={comments().length > 3}>
          <span class="text-[10px] text-white/30 px-1.5">
            +{comments().length - 3} more
          </span>
        </Show>
      </div>
    </div>
  );
};
