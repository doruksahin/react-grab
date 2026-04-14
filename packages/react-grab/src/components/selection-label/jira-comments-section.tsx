import { type Component, For, Show } from "solid-js";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible.jsx";
import { JiraCommentEditor } from "../editor/jira-comment-editor.js";
import { useJiraComments, type JiraComment } from "../../features/sidebar/use-jira-comments.js";
import { getApiBaseUrl } from "../../generated/custom-fetch.js";

// Reuse same image parsing from the parent — lightweight inline version
const IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
type Segment = { kind: "text"; text: string } | { kind: "image"; alt: string; url: string };

function parseBody(body: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  const base = getApiBaseUrl();
  for (const m of body.matchAll(IMG_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) segments.push({ kind: "text", text: body.slice(last, idx) });
    const url = m[2]!.startsWith("/") ? `${base}${m[2]}` : m[2]!;
    segments.push({ kind: "image", alt: m[1]!, url });
    last = idx + m[0]!.length;
  }
  if (last < body.length) segments.push({ kind: "text", text: body.slice(last) });
  return segments;
}

const CommentBody: Component<{ body: string }> = (props) => (
  <div class="text-muted-foreground whitespace-pre-wrap wrap-break-word">
    <For each={parseBody(props.body)}>
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

export interface JiraCommentsSectionProps {
  comments: ReadonlyArray<JiraComment>;
  onSubmitComment: (markdown: string, mentions: Array<{ text: string; accountId: string }>, parentId?: string) => Promise<{ id: string; created: string }>;
  onSearchUsers?: (query: string) => Promise<Array<{ accountId: string; displayName: string; avatarUrl: string | null }>>;
  onRefreshPoll: () => void;
}

export const JiraCommentsSection: Component<JiraCommentsSectionProps> = (props) => {
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
            <div class="flex flex-col w-[calc(100%+16px)] -mx-2 px-2 py-1 gap-2 max-h-[200px] overflow-y-auto">
              <For each={rootComments()}>
                {(root) => (
                  <div class="flex flex-col gap-1 group">
                    <div class="text-[11px] leading-tight text-popover-foreground">
                      <div class="flex items-center justify-between">
                        <div class="font-medium">{root.author}</div>
                        <Show when={root.sending}>
                          <span class="text-[9px] text-muted-foreground italic">sending...</span>
                        </Show>
                      </div>
                      <CommentBody body={root.body} />
                    </div>
                    <button
                      data-react-grab-comment-reply
                      data-react-grab-ignore-events
                      class="text-[10px] text-muted-foreground hover:text-foreground mt-0.5 opacity-0 group-hover:opacity-100 self-start"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setReplyTo({ id: root.id, author: root.author });
                      }}
                    >
                      Reply
                    </button>
                    <For each={replies(root.id)}>
                      {(reply) => (
                        <div class="flex gap-1 pl-2 border-l border-muted-foreground/20">
                          <div class="text-[11px] leading-tight text-popover-foreground flex-1 min-w-0">
                            <div class="flex items-center justify-between">
                              <div class="font-medium">{reply.author}</div>
                              <Show when={reply.sending}>
                                <span class="text-[9px] text-muted-foreground italic">sending...</span>
                              </Show>
                            </div>
                            <CommentBody body={reply.body} />
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                )}
              </For>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Show>

      {/* Error display */}
      <Show when={error()}>
        <div class="text-[10px] text-destructive px-1 py-0.5 mt-1">{error()}</div>
      </Show>

      {/* Comment editor */}
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
