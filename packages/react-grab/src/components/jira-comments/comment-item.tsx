import { type Component, For, Show } from "solid-js";
import type { JiraComment } from "../../features/jira-comments/types.js";
import { parseCommentBody } from "../../features/jira-comments/parse-comment-body.js";
import { relativeTime } from "../../features/sidebar/relative-time.js";
import { Avatar } from "./avatar.js";

const CommentBody: Component<{ body: string }> = (props) => (
  <div class="text-muted-foreground whitespace-pre-wrap wrap-break-word text-[11px]">
    <For each={parseCommentBody(props.body)}>
      {(seg) =>
        seg.kind === "text" ? (
          <span>{seg.text}</span>
        ) : (
          <img src={seg.url} alt={seg.alt} class="max-w-full h-auto my-1 rounded" loading="lazy" />
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
      class={`flex gap-2 ${props.isReply ? "pl-6" : ""} ${props.comment.sending ? "opacity-50" : ""}`}
      style={{ "pointer-events": "auto" }}
    >
      <Avatar name={props.comment.author} url={props.comment.authorAvatar} size={props.isReply ? 18 : 20} />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5">
          <span class="text-[11px] font-medium text-popover-foreground">{props.comment.author}</span>
          <span class="text-[9px] text-muted-foreground">{props.comment.sending ? "sending..." : ts()}</span>
        </div>
        <CommentBody body={props.comment.body} />
        <Show when={!props.isReply && !props.comment.sending}>
          <button
            data-react-grab-comment-reply
            data-react-grab-ignore-events
            class="text-[9px] text-muted-foreground hover:text-foreground mt-0.5 opacity-0 group-hover:opacity-100"
            onMouseDown={(e) => { e.preventDefault(); props.onReply?.(); }}
          >
            Reply
          </button>
        </Show>
      </div>
    </div>
  );
};
