import { type Component, For, Show } from "solid-js";
import type { GroupedEntry } from "../../features/sidebar";
import { deriveStatus, relativeTime } from "../../features/sidebar";
import { StatusBadge } from "./status-badge";

interface GroupCardProps {
  entry: GroupedEntry;
  onClick: () => void;
}

export const GroupCard: Component<GroupCardProps> = (props) => {
  const status = () => deriveStatus(props.entry);
  const comments = () => props.entry.items;

  return (
    <div
      class="bg-[#232323] rounded-lg p-3 mb-1.5 cursor-pointer border border-transparent hover:border-white/10 hover:bg-[#2a2a2a] transition-colors"
      onClick={props.onClick}
    >
      <div class="flex items-center justify-between mb-1.5">
        <span class="font-semibold text-[13px] text-white">{props.entry.group.name}</span>
        <StatusBadge status={status()} />
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
