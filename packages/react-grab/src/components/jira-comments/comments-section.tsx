import { type Component, For, Show } from "solid-js";
import type { JiraComment, JiraCommentsSectionProps } from "../../features/jira-comments/types.js";
import { useJiraComments } from "../../features/jira-comments/use-jira-comments.js";
import { CollapsibleCard } from "../ui/collapsible.jsx";
import { JiraCommentEditor } from "./editor/jira-comment-editor.js";
import { CommentThread } from "./comment-thread.js";

export const CommentsSection: Component<JiraCommentsSectionProps> = (props) => {
  const { mergedComments, replyTo, setReplyTo, submitComment, error } = useJiraComments({
    serverComments: () => props.comments as JiraComment[],
    onSubmitComment: (md, mentions, parentId) => props.onSubmitComment(md, mentions, parentId),
    onRefreshPoll: () => props.onRefreshPoll(),
  });

  const rootComments = () => mergedComments().filter((c) => !c.parentId);
  const replies = (parentId: string) => mergedComments().filter((c) => c.parentId === parentId);

  return (
    <div data-react-grab-comments-section data-react-grab-ignore-events>
      <div class="border-t border-border/40 w-[calc(100%+16px)] -mx-2 mt-2" />
      <CollapsibleCard
        variant="inline"
        defaultOpen={true}
        trigger={
          <span>Comments <span data-react-grab-comments-count>({mergedComments().length})</span></span>
        }
      >
        <div class="flex flex-col gap-1">
          <div class="mb-2">
            <JiraCommentEditor
              onSearchUsers={props.onSearchUsers}
              onSubmit={(markdown, mentions) => submitComment(markdown, mentions)}
              toolbarInitiallyVisible={props.commentEditorToolbarVisible}
            />
          </div>

          <Show when={error()}>
            <div data-react-grab-comments-error class="text-[10px] text-destructive px-1 py-0.5">{error()}</div>
          </Show>

          <Show when={mergedComments().length > 0}>
            <div data-react-grab-comments-list class="flex flex-col gap-4 max-h-[300px] overflow-y-auto">
              <For each={rootComments()}>
                {(root) => (
                  <CommentThread
                    root={root}
                    replies={replies(root.id)}
                    isReplying={replyTo()?.id === root.id}
                    onReply={() => setReplyTo({ id: root.id, author: root.author })}
                    onCancelReply={() => setReplyTo(null)}
                    onSubmitReply={(md, mentions) => submitComment(md, mentions, root.id)}
                    onSearchUsers={props.onSearchUsers}
                    toolbarInitiallyVisible={props.commentEditorToolbarVisible}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>
      </CollapsibleCard>
    </div>
  );
};
