import { type Component, createSignal, For, Show } from "solid-js";
import { relativeTime } from "../../features/sidebar/relative-time.js";

interface JiraComment {
  id: string;
  parentId: string | null;
  author: string;
  authorAvatar: string | null;
  body: string;
  createdAt: string;
}

interface CardCommentsProps {
  comments: JiraComment[];
}

const MENTION_REGEX = /(@\w+)/g;

const getInitials = (name: string): string =>
  name.slice(0, 2).toUpperCase();

const renderBody = (body: string) => {
  const parts = body.split(MENTION_REGEX);
  return (
    <For each={parts}>
      {(part) => (
        <Show
          when={part.startsWith("@")}
          fallback={<>{part}</>}
        >
          <span class="bg-blue-500/10 text-blue-400 px-0.5 rounded text-[10px]">
            {part}
          </span>
        </Show>
      )}
    </For>
  );
};

const MiniComment: Component<{ comment: JiraComment }> = (props) => (
  <div class="flex gap-2 py-1.5">
    <div class="w-[22px] h-[22px] rounded-full bg-foreground/10 flex items-center justify-center shrink-0">
      <span class="text-[8px] font-bold text-foreground">
        {getInitials(props.comment.author)}
      </span>
    </div>
    <div class="min-w-0">
      <div class="flex items-baseline gap-1.5">
        <span class="text-[10px] font-semibold text-foreground/80">
          {props.comment.author}
        </span>
        <span class="text-[9px] text-muted-foreground">
          {relativeTime(new Date(props.comment.createdAt).getTime())}
        </span>
      </div>
      <div class="text-[11px] text-foreground/60 leading-relaxed">
        {renderBody(props.comment.body)}
      </div>
    </div>
  </div>
);

export const CardComments: Component<CardCommentsProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);

  const rootComments = () =>
    props.comments.filter((c) => !c.parentId);

  const repliesFor = (parentId: string) =>
    props.comments.filter((c) => c.parentId === parentId);

  return (
    <div>
      {/* Toggle header */}
      <div
        class="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground cursor-pointer hover:text-foreground py-1 mt-2"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M2 3h12v8H6l-3 3v-3H2z" />
        </svg>
        <span>Comments ({props.comments.length})</span>
        <span
          class="text-[8px] transition-transform duration-150"
          style={{
            transform: isOpen() ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          &#9662;
        </span>
      </div>

      {/* Comment body */}
      <Show when={isOpen()}>
        <div>
          <For each={rootComments()}>
            {(comment, index) => (
              <div>
                <Show when={index() > 0}>
                  <div class="border-t border-foreground/[0.04]" />
                </Show>
                <MiniComment comment={comment} />

                {/* Replies */}
                <Show when={repliesFor(comment.id).length > 0}>
                  <div class="ml-[30px] border-l-2 border-foreground/[0.06] pl-2">
                    <For each={repliesFor(comment.id)}>
                      {(reply) => <MiniComment comment={reply} />}
                    </For>
                  </div>
                </Show>
              </div>
            )}
          </For>

          {/* Mini composer */}
          <div class="flex gap-1.5 items-center mt-1.5 pt-1.5 border-t border-foreground/[0.04]">
            <div class="w-[20px] h-[20px] rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
              <span class="text-[8px] font-bold text-purple-400">Y</span>
            </div>
            <input
              type="text"
              placeholder="Reply..."
              class="flex-1 bg-foreground/[0.03] border border-border rounded-md px-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground outline-none focus:border-purple-400"
              readOnly
            />
          </div>
        </div>
      </Show>
    </div>
  );
};
