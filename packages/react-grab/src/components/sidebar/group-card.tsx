import { type Component, createSignal, For, Show } from "solid-js";
import type { GroupedEntry } from "../../features/sidebar/index.js";
import { relativeTime } from "../../features/sidebar/index.js";
import { getStatusChip } from "../../features/sidebar/get-status-chip.js";
import { Avatar } from "../ui/avatar.js";
import { StatusChip } from "../ui/status-chip.js";
import { IconButton } from "../ui/icon-button.js";
import { GroupChildren } from "./group-children.js";
import { Badge } from "../ui/badge.js";

interface GroupCardProps {
  entry: GroupedEntry;
  onDetailOpen: (groupId: string, cardEl: HTMLElement) => void;
}

export const GroupCard: Component<GroupCardProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(false);
  const statusChip = () => getStatusChip(props.entry.group);
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
      style={{ "border-left": `2px solid ${statusChip().color.hex}` }}
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
            <span class="font-semibold text-body text-foreground truncate">
              {props.entry.group.name}
            </span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <StatusChip {...statusChip()} />
            <IconButton
              label="Open detail view"
              class="opacity-0 group-hover/card:opacity-100"
              onClick={handleDetailOpen}
            >
              <svg viewBox="0 0 16 16" class="w-2.5 h-2.5">
                <path
                  fill="currentColor"
                  d="m6.03 1.47 6 6a.75.75 0 0 1 .052 1.004l-.052.056-6 6-1.06-1.06L10.44 8 4.97 2.53z"
                />
              </svg>
            </IconButton>
          </div>
        </div>

        <div class="flex gap-3 text-meta text-muted-foreground mb-2">
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
          <div class="flex gap-3 text-meta mb-2">
            <Show when={props.entry.group.jiraAssignee}>
              <span class="flex items-center gap-1.5 text-meta text-muted-foreground">
                <Avatar
                  name={props.entry.group.jiraAssignee}
                  src={props.entry.group.jiraAssigneeAvatar}
                  size="sm"
                />
                {props.entry.group.jiraAssignee}
              </span>
            </Show>
            <Show when={props.entry.group.jiraReporter}>
              <span class="flex items-center gap-1.5 text-meta text-muted-foreground">
                <Avatar
                  name={props.entry.group.jiraReporter}
                  src={props.entry.group.jiraReporterAvatar}
                  size="sm"
                />
                {props.entry.group.jiraReporter}
              </span>
            </Show>
          </div>
        </Show>

        <Show when={props.entry.group.jiraLabels?.length}>
          <div class="flex flex-wrap gap-1 mb-2">
            <For each={props.entry.group.jiraLabels}>
              {(lbl) => <Badge>{lbl}</Badge>}
            </For>
          </div>
        </Show>

        <Show when={!isExpanded()}>
          <div class="flex flex-col gap-1">
            <For each={comments().slice(0, 3)}>
              {(comment) => (
                <div class="flex items-center gap-1.5 text-meta">
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
              <span class="text-meta text-muted-foreground px-1.5">
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
