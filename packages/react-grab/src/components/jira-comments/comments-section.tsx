import { type Component, createSignal, For, Show } from "solid-js";
import type { JiraComment, JiraCommentsSectionProps } from "../../features/jira-comments/types.js";
import { useJiraComments } from "../../features/jira-comments/use-jira-comments.js";
import { JiraCommentEditor } from "./editor/jira-comment-editor.js";
import { CommentThread } from "./comment-thread.js";

export const CommentsSection: Component<JiraCommentsSectionProps> = (props) => {
  const { mergedComments, replyTo, setReplyTo, submitComment, error } = useJiraComments({
    serverComments: () => props.comments as JiraComment[],
    onSubmitComment: props.onSubmitComment,
    onRefreshPoll: props.onRefreshPoll,
  });

  const rootComments = () => mergedComments().filter((c) => !c.parentId);
  const replies = (parentId: string) => mergedComments().filter((c) => c.parentId === parentId);
  const [isOpen, setIsOpen] = createSignal(true);

  return (
    <div data-react-grab-ignore-events>
      <Show when={mergedComments().length > 0}>
        <button
          data-react-grab-ignore-events
          class="flex items-center justify-between w-[calc(100%+16px)] -mx-2 mt-1 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent cursor-pointer"
          aria-expanded={isOpen()}
          onPointerDown={(e: PointerEvent) => e.stopPropagation()}
          onClick={(e: MouseEvent) => {
            e.stopImmediatePropagation();
            setIsOpen((prev) => !prev);
          }}
        >
          <span>Comments ({mergedComments().length})</span>
          <span class="text-[10px]" style={{ transform: isOpen() ? undefined : "rotate(-90deg)", transition: "transform 0.15s" }}>▾</span>
        </button>

        <div
          class="flex flex-col w-[calc(100%+16px)] -mx-2 px-2 py-1.5 gap-1"
          style={{ display: isOpen() ? undefined : "none" }}
        >
          <div class="mb-2">
            <JiraCommentEditor
              onSearchUsers={props.onSearchUsers}
              onSubmit={(markdown, mentions) => submitComment(markdown, mentions)}
            />
          </div>

          <Show when={error()}>
            <div class="text-[10px] text-destructive px-1 py-0.5">{error()}</div>
          </Show>

          <div class="flex flex-col gap-4 max-h-[300px] overflow-y-auto">
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
                />
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
};
