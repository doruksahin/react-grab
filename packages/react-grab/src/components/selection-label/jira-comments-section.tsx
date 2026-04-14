import { type Component, For, Show } from "solid-js";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible.jsx";
import { JiraCommentEditor } from "../editor/jira-comment-editor.js";
import { useJiraComments, type JiraComment } from "../../features/sidebar/use-jira-comments.js";
import { getApiBaseUrl } from "../../generated/custom-fetch.js";
import { relativeTime } from "../../features/sidebar/relative-time.js";

// Image parsing for markdown bodies
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
  <div class="text-muted-foreground whitespace-pre-wrap wrap-break-word text-[11px]">
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

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function avatarColor(name: string): string {
  const colors = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c", "#3498db", "#9b59b6", "#e91e63"];
  let hash = 0;
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length]!;
}

const Avatar: Component<{ name: string; url: string | null; size?: number }> = (props) => {
  const sz = () => props.size ?? 20;
  return (
    <Show
      when={props.url}
      fallback={
        <div
          class="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
          style={{
            width: `${sz()}px`,
            height: `${sz()}px`,
            "font-size": `${Math.round(sz() * 0.4)}px`,
            background: avatarColor(props.name),
          }}
        >
          {initials(props.name)}
        </div>
      }
    >
      <img
        src={props.url!}
        alt={props.name}
        class="rounded-full flex-shrink-0"
        style={{ width: `${sz()}px`, height: `${sz()}px` }}
      />
    </Show>
  );
};

const CommentItem: Component<{
  comment: JiraComment;
  onReply?: () => void;
  isReply?: boolean;
}> = (props) => {
  const ts = () => {
    const d = new Date(props.comment.createdAt).getTime();
    return relativeTime(d);
  };

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
            onMouseDown={(e) => {
              e.preventDefault();
              props.onReply?.();
            }}
          >
            Reply
          </button>
        </Show>
      </div>
    </div>
  );
};

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
            <div class="flex flex-col w-[calc(100%+16px)] -mx-2 px-2 py-1.5 gap-3 max-h-[250px] overflow-y-auto">
              <For each={rootComments()}>
                {(root) => (
                  <div class="flex flex-col gap-1.5 group">
                    <CommentItem
                      comment={root}
                      onReply={() => setReplyTo({ id: root.id, author: root.author })}
                    />
                    <For each={replies(root.id)}>
                      {(reply) => (
                        <CommentItem comment={reply} isReply />
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
