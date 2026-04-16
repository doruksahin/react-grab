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
              <svg width="14" height="14" viewBox="0 0 16 16">
                <path fill="currentColor" fill-rule="evenodd" d="m1.22 4.72 3.5-3.5 1.06 1.06L3.56 4.5h6.69a4.75 4.75 0 1 1 0 9.5H8v-1.5h2.25a3.25 3.25 0 0 0 0-6.5H3.56l2.22 2.22-1.06 1.06-3.5-3.5a.75.75 0 0 1 0-1.06" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
};
