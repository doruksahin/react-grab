import { type Component, For, Show } from "solid-js";
import type { CommentItem } from "../../types.js";
import { relativeTime } from "../../features/sidebar/relative-time.js";

interface GroupChildrenProps {
  items: CommentItem[];
}

export const GroupChildren: Component<GroupChildrenProps> = (props) => {
  return (
    <div class="bg-foreground/[0.02]">
      <For each={props.items}>
        {(item, index) => {
          const isLast = () => index() === props.items.length - 1;

          return (
            <div class="relative px-4 py-3 pl-7 border-b border-foreground/[0.04]">
              {/* Vertical connector line */}
              <div
                class="absolute left-[18px] top-0 w-px bg-foreground/10"
                classList={{ "bottom-0": !isLast(), "bottom-1/2": isLast() }}
              />

              {/* Dot */}
              <div class="absolute left-[15px] top-[18px] w-[7px] h-[7px] rounded-full bg-foreground/10 border border-foreground/20" />

              {/* Content */}
              <div class="text-[11px] text-foreground/70 leading-relaxed mb-1.5">
                {item.commentText || item.componentName || item.tagName}
              </div>

              <Show when={item.screenshotElement || item.screenshotFullPage}>
                <div class="flex gap-1 mb-1.5">
                  <Show when={item.screenshotElement}>
                    <div class="w-[44px] h-[30px] bg-foreground/[0.04] border border-border rounded" />
                  </Show>
                  <Show when={item.screenshotFullPage}>
                    <div class="w-[44px] h-[30px] bg-foreground/[0.04] border border-border rounded" />
                  </Show>
                </div>
              </Show>

              <div class="text-[9px] text-muted-foreground">
                {relativeTime(item.timestamp)}
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
};
