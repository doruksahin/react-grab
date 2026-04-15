import type { Component } from "solid-js";
import type { InlineReplyEditorProps } from "../../features/jira-comments/types.js";
import { Avatar } from "./avatar.js";
import { JiraCommentEditor } from "./editor/jira-comment-editor.js";

export const InlineReplyEditor: Component<InlineReplyEditorProps> = (props) => (
  <div class="ml-3 pl-3 mt-1.5 border-l-2 border-muted" data-react-grab-inline-reply>
    <div class="flex items-center gap-1.5 mb-1.5">
      <Avatar name={props.author} url={props.authorAvatar} size={16} />
      <span class="text-[10px] text-muted-foreground">
        Replying to <strong class="text-foreground">{props.author}</strong>
      </span>
    </div>
    <JiraCommentEditor
      placeholder={`Reply to ${props.author}...`}
      onSearchUsers={props.onSearchUsers}
      onCancel={props.onCancel}
      onSubmit={props.onSubmit}
    />
  </div>
);
