import { type Component, createMemo, For, Show } from "solid-js";
import type { CommentItem } from "../../types.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
import { relativeTime } from "../../features/sidebar/relative-time.js";
import { CardComments } from "./card-comments.js";
import { IssueTypeIcon } from "./issue-type-icon.js";
import { PriorityIcon } from "./priority-icon.js";
import { UserAvatar } from "./UserAvatar.js";

interface SelectionListTabProps {
  commentItems: CommentItem[];
  groups: SelectionGroupWithJira[];
}

const getStatusPillClass = (category?: string): string => {
  switch (category) {
    case "indeterminate":
      return "text-blue-400 bg-blue-400/[0.12]";
    case "done":
      return "text-green-400 bg-green-400/[0.12]";
    case "new":
    default:
      return "text-muted-foreground bg-foreground/[0.06]";
  }
};

const getStatusDisplayText = (group?: SelectionGroupWithJira): string => {
  if (!group?.jiraTicketId) return "no ticket";
  return group.jiraStatus ?? "To Do";
};

const formatDueDate = (dueDate: string): string =>
  new Date(dueDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const SelectionListTab: Component<SelectionListTabProps> = (props) => {
  const groupMap = createMemo(
    () => new Map(props.groups.map((g) => [g.id, g])),
  );

  return (
    <div class="flex-1 overflow-y-auto">
      <For each={props.commentItems}>
        {(item) => {
          const group = () => (item.groupId ? groupMap().get(item.groupId) : undefined);
          const isFlagged = () => group()?.jiraFlagged === true;
          const hasTicket = () => Boolean(group()?.jiraTicketId);
          const summary = () =>
            item.commentText || item.componentName || item.tagName;

          return (
            <div
              class="border-b border-border px-4 py-3 cursor-pointer hover:bg-foreground/[0.02]"
              classList={{
                "border-l-[3px] border-l-red-400 pl-[13px]": isFlagged(),
              }}
              style={{ position: "relative" }}
            >
              {/* JIRA status pill — absolute top-right */}
              <div class="absolute top-3 right-4">
                <Show
                  when={hasTicket()}
                  fallback={
                    <span class="text-[9px] uppercase font-medium text-muted-foreground italic">
                      no ticket
                    </span>
                  }
                >
                  <span
                    class={`text-[9px] uppercase font-medium px-1.5 py-0.5 rounded ${getStatusPillClass(group()?.jiraStatusCategory)}`}
                  >
                    {getStatusDisplayText(group())}
                  </span>
                </Show>
              </div>

              {/* Summary text */}
              <div class="text-[12px] font-medium text-foreground pr-16 truncate">
                {summary()}
              </div>

              {/* Labels row */}
              <Show when={group()?.jiraLabels?.length}>
                <div class="flex flex-wrap gap-1.5 mt-1.5">
                  <For each={group()?.jiraLabels}>
                    {(label) => (
                      <span class="bg-foreground/[0.06] text-muted-foreground text-[9px] font-medium px-1.5 py-0.5 rounded">
                        {label}
                      </span>
                    )}
                  </For>
                </div>
              </Show>

              {/* Date range row */}
              <div class="flex items-center gap-1.5 mt-1.5 text-[10px] text-muted-foreground">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <rect x="2" y="3" width="12" height="11" rx="2" />
                  <path d="M2 7h12M5 1v4M11 1v4" />
                </svg>
                <span>{relativeTime(item.timestamp)}</span>
                <span class="text-muted-foreground/50">{"\u2192"}</span>
                <Show
                  when={group()?.jiraDueDate}
                  fallback={<span class="italic">No due date</span>}
                >
                  <span>{formatDueDate(group()!.jiraDueDate!)}</span>
                </Show>
              </div>

              {/* Screenshot row */}
              <Show when={item.screenshotElement || item.screenshotFullPage}>
                <div class="flex gap-1.5 mt-1.5">
                  <Show when={item.screenshotElement}>
                    <div class="w-[52px] h-[34px] bg-foreground/[0.04] border border-border rounded" />
                  </Show>
                  <Show when={item.screenshotFullPage}>
                    <div class="w-[52px] h-[34px] bg-foreground/[0.04] border border-border rounded" />
                  </Show>
                </div>
              </Show>

              {/* Bottom row */}
              <div class="flex items-center gap-1.5 mt-1.5">
                <IssueTypeIcon issueType={group()?.jiraIssueType} />

                <Show
                  when={group()?.jiraTicketId}
                  fallback={
                    <span class="font-mono text-[10px] text-muted-foreground italic">
                      no ticket
                    </span>
                  }
                >
                  <span class="font-mono text-[10px] text-muted-foreground">
                    {group()?.jiraTicketId}
                  </span>
                </Show>

                <span class="flex-1" />

                <PriorityIcon priority={group()?.jiraPriority} />

                <Show when={group()?.jiraAssignee}>
                  <div class="flex items-center gap-1">
                    <UserAvatar
                      avatarUrl={group()?.jiraAssigneeAvatar}
                      displayName={group()?.jiraAssignee}
                      size={20}
                    />
                    <span class="text-[10px] text-muted-foreground">
                      {group()?.jiraAssignee}
                    </span>
                  </div>
                </Show>
              </div>

              {/* Inline comment threads */}
              <Show when={group()?.jiraComments?.length}>
                <CardComments comments={group()!.jiraComments!} />
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
};
