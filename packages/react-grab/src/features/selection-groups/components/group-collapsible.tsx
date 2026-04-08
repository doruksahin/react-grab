import { createSignal, For, Show } from "solid-js";
import type { Component, JSX } from "solid-js";
import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";
import { cn } from "../../../utils/cn.js";

interface GroupCollapsibleProps {
  group: SelectionGroup;
  items: CommentItem[];
  renderItem: (item: CommentItem) => JSX.Element;
  isFirst: boolean;
  onRename: (groupId: string, name: string) => void;
  onDelete: (groupId: string) => void;
  onToggleRevealed: (groupId: string) => void;
  onCopy?: (groupId: string) => void;
}

export const GroupCollapsible: Component<GroupCollapsibleProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(true);
  const [isRenaming, setIsRenaming] = createSignal(false);
  let renameInputRef: HTMLInputElement | undefined;

  const handleRenameSubmit = () => {
    if (!renameInputRef || !renameInputRef.value.trim()) {
      setIsRenaming(false);
      return;
    }
    props.onRename(props.group.id, renameInputRef.value.trim());
    setIsRenaming(false);
  };

  return (
    <div>
      {/* Group header */}
      <div
        class={cn(
          "group/header w-full flex items-center justify-between px-2 py-1.5 hover:bg-black/[0.03] cursor-pointer",
          !props.isFirst && "border-t border-[#D9D9D9]/50",
        )}
        onClick={() => !isRenaming() && setIsOpen((prev) => !prev)}
      >
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
          {/* Chevron */}
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
            class={cn("text-black/30 transition-transform duration-150 shrink-0", !isOpen() && "-rotate-90")}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
          {/* Group name (or rename input) */}
          <Show
            when={!isRenaming()}
            fallback={
              <input
                ref={renameInputRef}
                type="text"
                value={props.group.name}
                class="text-[12px] font-semibold text-black/70 bg-transparent outline-none border-b border-black/30 min-w-0 flex-1"
                on:click={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameSubmit();
                  if (e.key === "Escape") setIsRenaming(false);
                }}
                onFocusOut={handleRenameSubmit}
              />
            }
          >
            <span class="text-[12px] font-semibold text-black/70 truncate">
              {props.group.name}
            </span>
          </Show>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          {/* Hover actions — all groups are user groups now */}
          <div class="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
            <button
              data-react-grab-ignore-events
              class="text-black/30 hover:text-black/60 cursor-pointer p-0.5"
              on:click={(e) => {
                e.stopPropagation();
                setIsRenaming(true);
                requestAnimationFrame(() => {
                  renameInputRef?.focus();
                  renameInputRef?.select();
                });
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>
            </button>
            <button
              data-react-grab-ignore-events
              class="text-[#B91C1C]/50 hover:text-[#B91C1C] cursor-pointer p-0.5"
              on:click={(e) => {
                e.stopPropagation();
                props.onDelete(props.group.id);
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
          {/* Copy button — always visible for all groups */}
          <button
            data-react-grab-ignore-events
            class="flex items-center justify-center w-[18px] h-[18px] rounded hover:bg-black/5 transition-colors"
            on:click={(e) => {
              e.stopPropagation();
              props.onCopy?.(props.group.id);
            }}
            on:pointerdown={(e) => e.stopPropagation()}
            aria-label="Copy group selections"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-black/20 hover:text-black/50 transition-colors">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
          </button>
          {/* Group eye toggle */}
          <button
            data-react-grab-ignore-events
            class="flex items-center justify-center w-[18px] h-[18px] rounded hover:bg-black/5 transition-colors"
            on:click={(e) => {
              e.stopPropagation();
              props.onToggleRevealed(props.group.id);
            }}
            on:pointerdown={(e) => e.stopPropagation()}
            aria-label={props.group.revealed ? "Hide group selections" : "Reveal group selections"}
          >
            {props.group.revealed ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-500">
                <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>
                <circle cx="12" cy="12" r="3" fill="currentColor"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-black/20">
                <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/>
                <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/>
                <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/>
                <path d="m2 2 20 20"/>
              </svg>
            )}
          </button>
          {/* Count badge */}
          <span class="text-[10px] font-medium text-black/30 bg-black/[0.05] rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
            {props.items.length}
          </span>
        </div>
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
            <For each={props.items}>
              {(item) => props.renderItem(item)}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
};
