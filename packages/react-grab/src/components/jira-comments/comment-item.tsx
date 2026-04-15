import { type Component, For, Show } from "solid-js";
import type { JiraComment } from "../../features/jira-comments/types.js";
import { parseCommentBody } from "../../features/jira-comments/parse-comment-body.js";
import { relativeTime } from "../../features/sidebar/relative-time.js";
import { Avatar } from "./avatar.js";

const CommentBody: Component<{ body: string }> = (props) => (
  <div class="text-muted-foreground whitespace-pre-wrap wrap-break-word text-[12px]">
    <For each={parseCommentBody(props.body)}>
      {(seg) =>
        seg.kind === "text" ? (
          <span>{seg.text}</span>
        ) : seg.kind === "mention" ? (
          <span class="bg-[rgba(88,101,242,0.2)] text-[#7b8cf8] px-1 py-px rounded text-[11px] font-medium">
            @{seg.name}
          </span>
        ) : (
          <div class="inline-block my-1 border border-border rounded-lg overflow-hidden max-w-[180px]">
            <img src={seg.url} alt={seg.alt} class="w-full max-h-[120px] object-cover block" loading="lazy" />
            <div class="px-2 py-1">
              <div class="text-[10px] text-muted-foreground truncate">{seg.alt || "attachment"}</div>
            </div>
          </div>
        )
      }
    </For>
  </div>
);

export const CommentItem: Component<{
  comment: JiraComment;
  onReply?: () => void;
  isReply?: boolean;
}> = (props) => {
  const ts = () => relativeTime(new Date(props.comment.createdAt).getTime());

  return (
    <div
      class={`flex gap-2.5 ${props.comment.sending ? "opacity-50" : ""}`}
      style={{ "pointer-events": "auto" }}
    >
      <Avatar name={props.comment.author} url={props.comment.authorAvatar} size={props.isReply ? 20 : 24} />
      <div class="flex-1 min-w-0">
        <div class="flex flex-col">
          <span class="text-[12px] font-semibold text-popover-foreground leading-tight">{props.comment.author}</span>
          <span class="text-[10px] text-muted-foreground leading-tight">{props.comment.sending ? "sending..." : ts()}</span>
        </div>
        <div class="mt-1">
          <CommentBody body={props.comment.body} />
        </div>
        <Show when={!props.isReply && !props.comment.sending}>
          <div class="flex gap-0.5 mt-1 opacity-0 group-hover:opacity-100">
            <button
              data-react-grab-comment-reply
              data-react-grab-ignore-events
              class="text-muted-foreground hover:text-foreground hover:bg-accent p-0.5 rounded"
              title="Reply"
              onMouseDown={(e) => { e.preventDefault(); props.onReply?.(); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 17H4v-5" /><path d="M4 17l7-7 4 4 5-5" />
              </svg>
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
};
