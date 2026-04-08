import { createSignal, For, Show } from "solid-js";
import type { Component, JSX } from "solid-js";
import type { CommentItem } from "../../../types.js";
import { cn } from "../../../utils/cn.js";

interface UngroupedSectionProps {
  items: CommentItem[];
  renderItem: (item: CommentItem) => JSX.Element;
  /** Whether this section is the first in its container (controls top border). */
  isFirst: boolean;
}

/**
 * Sibling of GroupCollapsible that renders selections without a group.
 * Header is non-interactive (no rename / delete / copy / reveal toggles —
 * "Ungrouped" is not a real group, so those actions don't apply).
 */
export const UngroupedSection: Component<UngroupedSectionProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(true);

  return (
    <div data-react-grab-ungrouped-section>
      {/* Header */}
      <div
        class={cn(
          "group/header w-full flex items-center justify-between px-2 py-1.5 hover:bg-black/[0.03] cursor-pointer",
          !props.isFirst && "border-t border-[#D9D9D9]/50",
        )}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
            class={cn("text-black/30 transition-transform duration-150 shrink-0", !isOpen() && "-rotate-90")}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
          <span class="text-[12px] font-semibold text-black/70 truncate">
            Ungrouped
          </span>
        </div>
        <span class="text-[10px] font-medium text-black/30 bg-black/[0.05] rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
          {props.items.length}
        </span>
      </div>
      {/* Collapsible items */}
      <div
        class="grid transition-[grid-template-rows] duration-150 ease-out"
        style={{ "grid-template-rows": isOpen() ? "1fr" : "0fr" }}
      >
        <div class="min-h-0 overflow-hidden">
          <Show
            when={props.items.length > 0}
            fallback={
              <div class="px-2 py-2 text-[11px] text-black/30 text-center italic">
                No selections yet
              </div>
            }
          >
            <For each={props.items}>{(item) => props.renderItem(item)}</For>
          </Show>
        </div>
      </div>
    </div>
  );
};
