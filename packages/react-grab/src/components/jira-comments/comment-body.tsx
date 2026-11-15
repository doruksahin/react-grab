import { type Component, For } from "solid-js";
import { parseCommentBody } from "../../features/jira-comments/parse-comment-body.js";

export const CommentBody: Component<{ body: string }> = (props) => (
  <div
    data-react-grab-comment-body
    class="text-muted-foreground whitespace-pre-wrap wrap-break-word text-caption"
  >
    <For each={parseCommentBody(props.body)}>
      {(seg) =>
        seg.kind === "text" ? (
          <span>{seg.text}</span>
        ) : seg.kind === "mention" ? (
          <span
            data-react-grab-mention
            class="bg-mention-surface text-mention px-1 py-px rounded text-meta font-medium"
          >
            @{seg.name}
          </span>
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
