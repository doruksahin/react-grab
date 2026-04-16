import { type Component, createSignal, For, Show } from "solid-js";
import type { JiraComment, JiraCommentsSectionProps } from "../../features/jira-comments/types.js";
import { useJiraComments } from "../../features/jira-comments/use-jira-comments.js";
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
  const [isOpen, setIsOpen] = createSignal(true);

  return (
    <div data-react-grab-comments-section data-react-grab-ignore-events>
      <div class="border-t border-border/40 w-[calc(100%+16px)] -mx-2 mt-2" />
      <button
        data-react-grab-comments-collapse
        data-react-grab-ignore-events
        class="flex items-center justify-between w-[calc(100%+16px)] -mx-2 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent cursor-pointer"
        aria-expanded={isOpen()}
        onPointerDown={(e: PointerEvent) => e.stopPropagation()}
        onClick={(e: MouseEvent) => {
          e.stopImmediatePropagation();
          setIsOpen((prev) => !prev);
        }}
      >
        <span>Comments <span data-react-grab-comments-count>({mergedComments().length})</span></span>
        <span class="text-[10px]" style={{ transform: isOpen() ? undefined : "rotate(-90deg)", transition: "transform 0.15s" }}>▾</span>
      </button>

      <div
        class="w-[calc(100%+16px)] -mx-2 overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out"
        style={{
          "max-height": isOpen() ? "600px" : "0px",
          opacity: isOpen() ? "1" : "0",
        }}
      >
        <div class="flex flex-col px-2 py-1.5 gap-1">
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
      </div>
    </div>
  );
};
