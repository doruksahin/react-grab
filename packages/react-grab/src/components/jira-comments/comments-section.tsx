import { type Component, For, Show } from "solid-js";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible.jsx";
import type { JiraComment, JiraCommentsSectionProps } from "../../features/jira-comments/types.js";
import { useJiraComments } from "../../features/jira-comments/use-jira-comments.js";
import { JiraCommentEditor } from "./editor/jira-comment-editor.js";
import { CommentItem } from "./comment-item.js";

export const CommentsSection: Component<JiraCommentsSectionProps> = (props) => {
  const { mergedComments, replyTo, setReplyTo, submitComment, error } = useJiraComments({
    serverComments: () => props.comments as JiraComment[],
    onSubmitComment: props.onSubmitComment,
    onRefreshPoll: props.onRefreshPoll,
  });

  const rootComments = () => mergedComments().filter((c) => !c.parentId);
  const replies = (parentId: string) => mergedComments().filter((c) => c.parentId === parentId);

  return (
    <div data-react-grab-ignore-events>
      <Show when={mergedComments().length > 0}>
        <Collapsible>
          <CollapsibleTrigger
            data-react-grab-ignore-events
            class="flex items-center justify-between w-[calc(100%+16px)] -mx-2 mt-1 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent cursor-pointer"
            onPointerDown={(e: PointerEvent) => e.stopPropagation()}
            onClick={(e: MouseEvent) => e.stopImmediatePropagation()}
          >
            <span>Comments ({mergedComments().length})</span>
            <span class="text-[10px]">▾</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div class="flex flex-col w-[calc(100%+16px)] -mx-2 px-2 py-1.5 gap-3 max-h-[250px] overflow-y-auto">
              <For each={rootComments()}>
                {(root) => (
                  <div class="flex flex-col gap-1.5 group">
                    <CommentItem
                      comment={root}
                      onReply={() => setReplyTo({ id: root.id, author: root.author })}
                    />
                    <For each={replies(root.id)}>
                      {(reply) => <CommentItem comment={reply} isReply />}
                    </For>
                  </div>
                )}
              </For>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Show>

      <Show when={error()}>
        <div class="text-[10px] text-destructive px-1 py-0.5 mt-1">{error()}</div>
      </Show>

      <div class="mt-1">
        <JiraCommentEditor
          replyTo={replyTo()}
          onCancelReply={() => setReplyTo(null)}
          onSearchUsers={props.onSearchUsers}
          onSubmit={(markdown, mentions) => submitComment(markdown, mentions)}
        />
      </div>
    </div>
  );
};
