import { type Component, createSignal, For, Show } from "solid-js";
import type { GroupedEntry } from "../../features/sidebar/index.js";
import { relativeTime } from "../../features/sidebar/index.js";
import {
  getStatusColor,
  getStatusLabel,
} from "../../features/sidebar/status-colors.js";
import { UserAvatar } from "./UserAvatar.js";
import { GroupChildren } from "./group-children.js";

interface GroupCardProps {
  entry: GroupedEntry;
  onDetailOpen: (groupId: string, cardEl: HTMLElement) => void;
}

export const GroupCard: Component<GroupCardProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(false);
  const statusLabel = () => getStatusLabel(props.entry.group);
  const statusColor = () => getStatusColor(props.entry.group.jiraStatus);
  const comments = () => props.entry.items;

  const handleCardClick = (e: MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  };

  const handleDetailOpen = (e: MouseEvent) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const card = target.closest("[data-react-grab-group-card]") as HTMLElement;
    props.onDetailOpen(props.entry.group.id, card);
  };

  return (
    <div
      data-react-grab-group-card
      class="group/card bg-muted rounded-lg mb-1.5 cursor-pointer border border-transparent hover:border-border hover:bg-accent transition-colors overflow-hidden"
      style={{ "border-left": `2px solid ${statusColor().hex}` }}
      onClick={handleCardClick}
    >
      <div class="p-3">
        <div class="flex items-center justify-between mb-1.5">
          <div class="flex items-center gap-1.5 min-w-0">
            {/* Chevron */}
            <svg
              viewBox="0 0 16 16"
              class="text-foreground/30 transition-transform duration-150 shrink-0 w-2.5 h-2.5"
              classList={{ "-rotate-90": !isExpanded() }}
            >
              <path
                fill="currentColor"
                d="m14.53 6.03-6 6a.75.75 0 0 1-1.004.052l-.056-.052-6-6 1.06-1.06L8 10.44l5.47-5.47z"
              />
            </svg>
            <span class="font-semibold text-[13px] text-foreground truncate">
              {props.entry.group.name}
            </span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <span
              class="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                background: statusColor().bg,
                color: statusColor().text,
              }}
            >
              {statusLabel()}
            </span>
            {/* Detail open button — visible on hover */}
            <button
              class="opacity-0 group-hover/card:opacity-100 transition-opacity p-0.5 rounded hover:bg-foreground/10"
              onClick={handleDetailOpen}
              title="Open detail view"
            >
              <svg viewBox="0 0 16 16" class="w-2.5 h-2.5 text-foreground/40">
                <path
                  fill="currentColor"
                  d="m6.03 1.47 6 6a.75.75 0 0 1 .052 1.004l-.052.056-6 6-1.06-1.06L10.44 8 4.97 2.53z"
                />
              </svg>
            </button>
          </div>
        </div>

        <div class="flex gap-3 text-[11px] text-muted-foreground mb-2">
          <span>{comments().length} selections</span>
          <span>{relativeTime(props.entry.group.createdAt)}</span>
          <Show when={props.entry.group.jiraTicketId}>
            <span class="text-blue-400">{props.entry.group.jiraTicketId}</span>
          </Show>
        </div>

        <Show
          when={
            props.entry.group.jiraAssignee || props.entry.group.jiraReporter
          }
        >
          <div class="flex gap-3 text-[11px] mb-2">
            <Show when={props.entry.group.jiraAssignee}>
              <span class="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <UserAvatar
                  avatarUrl={props.entry.group.jiraAssigneeAvatar}
                  displayName={props.entry.group.jiraAssignee}
                  size={16}
                />
                {props.entry.group.jiraAssignee}
              </span>
            </Show>
            <Show when={props.entry.group.jiraReporter}>
              <span class="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <UserAvatar
                  avatarUrl={props.entry.group.jiraReporterAvatar}
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
                <span class="text-[9px] px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground">
                  {lbl}
                </span>
              )}
            </For>
          </div>
        </Show>

        <Show when={!isExpanded()}>
          <div class="flex flex-col gap-1">
            <For each={comments().slice(0, 3)}>
              {(comment) => (
                <div class="flex items-center gap-1.5 text-[10px]">
                  <span class="px-1.5 py-0.5 rounded bg-muted text-foreground">
                    {comment.componentName || comment.elementName}
                  </span>
                  <span class="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {comment.tagName}
                  </span>
                  <Show when={comment.commentText}>
                    <span class="text-muted-foreground italic truncate max-w-[150px]">
                      {comment.commentText}
                    </span>
                  </Show>
                </div>
              )}
            </For>
            <Show when={comments().length > 3}>
              <span class="text-[10px] text-muted-foreground px-1.5">
                +{comments().length - 3} more
              </span>
            </Show>
          </div>
        </Show>
      </div>

      <Show when={isExpanded()}>
        <GroupChildren items={props.entry.items} />
      </Show>
    </div>
  );
};
