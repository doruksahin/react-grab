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
          "group/header w-full flex items-center justify-between px-2 py-1.5 hover:bg-foreground/[0.03] cursor-pointer",
          !props.isFirst && "border-t border-border",
        )}
        onClick={() => !isRenaming() && setIsOpen((prev) => !prev)}
      >
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
          {/* Chevron */}
          <svg
            width="10" height="10" viewBox="0 0 16 16"
            class={cn("text-foreground/30 transition-transform duration-150 shrink-0", !isOpen() && "-rotate-90")}
          >
            <path fill="currentColor" d="m14.53 6.03-6 6a.75.75 0 0 1-1.004.052l-.056-.052-6-6 1.06-1.06L8 10.44l5.47-5.47z" />
          </svg>
          {/* Group name (or rename input) */}
          <Show
            when={!isRenaming()}
            fallback={
              <input
                ref={renameInputRef}
                type="text"
                value={props.group.name}
                class="text-[12px] font-semibold text-foreground/70 bg-transparent outline-none border-b border-foreground/30 min-w-0 flex-1"
                on:click={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameSubmit();
                  if (e.key === "Escape") setIsRenaming(false);
                }}
                onFocusOut={handleRenameSubmit}
              />
            }
          >
            <span class="text-[12px] font-semibold text-foreground/70 truncate">
              {props.group.name}
            </span>
          </Show>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          {/* Hover actions — all groups are user groups now */}
          <div class="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
            <button
              data-react-grab-ignore-events
              class="text-foreground/30 hover:text-foreground/60 cursor-pointer p-0.5"
              on:click={(e) => {
                e.stopPropagation();
                setIsRenaming(true);
                requestAnimationFrame(() => {
                  renameInputRef?.focus();
                  renameInputRef?.select();
                });
              }}
            >
              <svg width="10" height="10" viewBox="0 0 16 16"><path fill="currentColor" fill-rule="evenodd" d="M11.586.854a2 2 0 0 1 2.828 0l.732.732a2 2 0 0 1 0 2.828L10.01 9.551a2 2 0 0 1-.864.51l-3.189.91a.75.75 0 0 1-.927-.927l.91-3.189a2 2 0 0 1 .51-.864zm1.768 1.06a.5.5 0 0 0-.708 0l-.585.586L13.5 3.94l.586-.586a.5.5 0 0 0 0-.708zM12.439 5 11 3.56 7.51 7.052a.5.5 0 0 0-.128.216l-.54 1.891 1.89-.54a.5.5 0 0 0 .217-.127zM3 2.501a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V10H15v3.001a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2h3v1.5z" clip-rule="evenodd" /></svg>
            </button>
            <button
              data-react-grab-ignore-events
              class="text-destructive/50 hover:text-destructive cursor-pointer p-0.5"
              on:click={(e) => {
                e.stopPropagation();
                props.onDelete(props.group.id);
              }}
            >
              <svg width="10" height="10" viewBox="0 0 16 16"><path fill="currentColor" fill-rule="evenodd" d="M5 .75A.75.75 0 0 1 5.75 0h4.5a.75.75 0 0 1 .75.75V2.5h3.5V4h-1v10a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V4h-1V2.5H5zM6.5 2.5h3v-1h-3zM4 4v10a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V4zm1.75 9V5.5h1.5V13zm3 0V5.5h1.5V13z" clip-rule="evenodd" /></svg>
            </button>
          </div>
          {/* Copy button — always visible for all groups */}
          <button
            data-react-grab-ignore-events
            class="flex items-center justify-center w-[18px] h-[18px] rounded hover:bg-foreground/5 transition-colors"
            on:click={(e) => {
              e.stopPropagation();
              props.onCopy?.(props.group.id);
            }}
            on:pointerdown={(e) => e.stopPropagation()}
            aria-label="Copy group selections"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" class="text-foreground/20 hover:text-foreground/50 transition-colors">
              <path fill="currentColor" fill-rule="evenodd" d="M1 3a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2zm2-.5a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5V3a.5.5 0 0 0-.5-.5zM16 6v6.75A3.25 3.25 0 0 1 12.75 16H6v-1.5h6.75a1.75 1.75 0 0 0 1.75-1.75V6z" clip-rule="evenodd" />
            </svg>
          </button>
          {/* Group eye toggle */}
          <button
            data-react-grab-ignore-events
            class="flex items-center justify-center w-[18px] h-[18px] rounded hover:bg-foreground/5 transition-colors"
            on:click={(e) => {
              e.stopPropagation();
              props.onToggleRevealed(props.group.id);
            }}
            on:pointerdown={(e) => e.stopPropagation()}
            aria-label={props.group.revealed ? "Hide group selections" : "Reveal group selections"}
          >
            {props.group.revealed ? (
              <svg width="12" height="12" viewBox="0 0 16 16" class="text-purple-500">
                <path fill="currentColor" d="M5.75 8a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0" />
                <path fill="currentColor" fill-rule="evenodd" d="M8 2C4.433 2 1.319 4.232.167 7.38c-.146.4-.146.84 0 1.24C1.32 11.768 4.433 14 8 14c3.566 0 6.681-2.232 7.833-5.38.146-.4.146-.84 0-1.24C14.68 4.232 11.566 2 8 2m0 2.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5" clip-rule="evenodd" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 16 16" class="text-foreground/20">
                <path fill="currentColor" fill-rule="evenodd" d="M8 3.5c-2.943 0-5.49 1.845-6.424 4.396a.3.3 0 0 0 0 .208C2.509 10.655 5.057 12.5 8 12.5s5.49-1.845 6.424-4.396a.3.3 0 0 0 0-.208C13.491 5.345 10.943 3.5 8 3.5M.167 7.38C1.32 4.232 4.433 2 8 2c3.566 0 6.681 2.232 7.833 5.38.146.4.146.84 0 1.24C14.68 11.768 11.566 14 8 14 4.433 14 1.319 11.768.167 8.62a1.8 1.8 0 0 1 0-1.24M8 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M5 8a3 3 0 1 1 6 0 3 3 0 0 1-6 0" clip-rule="evenodd" />
              </svg>
            )}
          </button>
          {/* Count badge */}
          <span class="text-[10px] font-medium text-foreground/30 bg-foreground/[0.05] rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
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
              <div class="px-2 py-2 text-[11px] text-foreground/30 text-center italic">
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
