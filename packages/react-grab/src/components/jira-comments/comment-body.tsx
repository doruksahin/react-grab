import { type Component, For } from "solid-js";
import { parseCommentBody } from "../../features/jira-comments/parse-comment-body.js";
import { cn } from "../../utils/cn.js";

interface CommentBodyProps {
  body: string;
  /** Text only: an image shows as its name, for one-line excerpts. */
  compact?: boolean;
  class?: string;
}

export const CommentBody: Component<CommentBodyProps> = (props) => (
  <div
    data-react-grab-comment-body
    class={cn(
      "text-muted-foreground whitespace-pre-wrap wrap-break-word text-caption",
      props.class,
    )}
  >
    <For each={parseCommentBody(props.body)}>
      {(seg) =>
        seg.kind === "text" ? (
          <span>{seg.text}</span>
        ) : seg.kind === "mention" ? (
          <span data-react-grab-mention class="mention-chip text-meta">
            @{seg.name}
          </span>
        ) : props.compact ? (
          <span class="italic">{seg.alt || "image"}</span>
        ) : (
          <div class="inline-block my-1 border border-border rounded-lg overflow-hidden max-w-[180px]">
            <img
              data-react-grab-comment-image
              src={seg.url}
              alt={seg.alt}
              class="w-full max-h-[120px] object-cover block"
              loading="lazy"
            />
            <div class="px-2 py-1">
              <div class="text-meta text-muted-foreground truncate">
                {seg.alt || "attachment"}
              </div>
            </div>
          </div>
        )
      }
    </For>
  </div>
);
