import { type Component, Show } from "solid-js";
import type { JiraComment } from "../../features/jira-comments/types.js";
import { relativeTime } from "../../features/sidebar/relative-time.js";
import { Avatar } from "./avatar.js";
import { CommentBody } from "./comment-body.js";

export const CommentItem: Component<{
  comment: JiraComment;
  onReply?: () => void;
  isReply?: boolean;
}> = (props) => {
  const ts = () => relativeTime(new Date(props.comment.createdAt).getTime());

  return (
    <div
      data-react-grab-jira-comment
      data-react-grab-jira-comment-id={props.comment.id}
      data-react-grab-jira-comment-state={props.comment.sending ? "sending" : "synced"}
      class={`flex gap-2.5 ${props.comment.sending ? "opacity-50" : ""}`}
      style={{ "pointer-events": "auto" }}
    >
      <Avatar name={props.comment.author} url={props.comment.authorAvatar} size={props.isReply ? 20 : 24} />
      <div class="flex-1 min-w-0">
        <div class="flex flex-col">
          <span data-react-grab-comment-author class="text-[12px] font-semibold text-popover-foreground leading-tight">{props.comment.author}</span>
          <span data-react-grab-comment-time class="text-[10px] text-muted-foreground leading-tight">{props.comment.sending ? "sending..." : ts()}</span>
        </div>
        <div class="mt-1">
          <CommentBody body={props.comment.body} />
        </div>
        <Show when={!props.isReply && !props.comment.sending}>
          <div class="flex gap-0.5 mt-1">
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
