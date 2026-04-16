import { type Component, For, Show } from "solid-js";
import type { CommentThreadProps } from "../../features/jira-comments/types.js";
import { CommentItem } from "./comment-item.js";
import { InlineReplyEditor } from "./inline-reply-editor.js";

export const CommentThread: Component<CommentThreadProps> = (props) => (
  <div data-react-grab-comment-thread class="flex flex-col group">
    <CommentItem
      comment={props.root}
      onReply={props.onReply}
    />

    <Show when={props.replies.length > 0}>
      <div class="ml-3 pl-3 mt-1.5 flex flex-col gap-2 border-l-2 border-muted">
        <For each={props.replies}>
          {(reply) => <CommentItem comment={reply} isReply />}
        </For>
      </div>
    </Show>

    <Show when={props.isReplying}>
      <InlineReplyEditor
        author={props.root.author}
        authorAvatar={props.root.authorAvatar}
        onSearchUsers={props.onSearchUsers}
        onCancel={props.onCancelReply}
        onSubmit={props.onSubmitReply}
      />
    </Show>
  </div>
);
