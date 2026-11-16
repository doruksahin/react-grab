import { createEffect, createSignal, For, on, Show } from "solid-js";
import type { Component, JSX } from "solid-js";
import type { CommentItem } from "../../types.js";
import { cn } from "../../utils/cn.js";
import { Badge } from "../ui/badge.js";

interface SelectionSectionProps {
  title: string;
  items: CommentItem[];
  renderItem: (item: CommentItem) => JSX.Element;
  /** Whether this section is the first in its container (controls top border). */
  isFirst: boolean;
  /** Opens the section when it holds this selection (a focus request). */
  revealItemId?: string | null;
  /** A short summary of the section's selections (the sidebar's statuses). */
  summary?: JSX.Element;
  emptyText?: string;
}

/**
 * A titled, collapsible run of selections whose header has no actions:
 * Ungrouped, or a status when the sidebar groups by status. The header
 * stays at the top while its selections scroll.
 */
export const SelectionSection: Component<SelectionSectionProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(true);
  // A focus request is a user action from elsewhere: the card it targets
  // must be visible, so its section opens.
  createEffect(
    on(
      () => props.revealItemId,
      (itemId) => {
        if (itemId && props.items.some((item) => item.id === itemId)) {
          setIsOpen(true);
        }
      },
    ),
  );

  return (
    <>
      <div
        class={cn(
          "group/header sticky top-0 z-[1] w-full flex items-center justify-between gap-2 px-2 py-1.5 bg-card hover:bg-muted cursor-pointer",
          !props.isFirst && "border-t border-border",
        )}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
          <svg
            width="10"
            height="10"
            viewBox="0 0 16 16"
            class={cn(
              "text-foreground/30 transition-transform duration-150 shrink-0",
              !isOpen() && "-rotate-90",
            )}
          >
            <path
              fill="currentColor"
              d="m14.53 6.03-6 6a.75.75 0 0 1-1.004.052l-.056-.052-6-6 1.06-1.06L8 10.44l5.47-5.47z"
            />
          </svg>
          <span class="text-caption font-semibold text-foreground/70 truncate">
            {props.title}
          </span>
        </div>
        {props.summary}
        <Badge variant="count">{props.items.length}</Badge>
      </div>
      <div
        class="grid transition-[grid-template-rows] duration-150 ease-out"
        style={{ "grid-template-rows": isOpen() ? "1fr" : "0fr" }}
      >
        <div class="min-h-0 overflow-hidden">
          <Show
            when={props.items.length > 0}
            fallback={
              <div class="px-2 py-2 text-meta text-muted-foreground text-center italic">
                {props.emptyText ?? "No selections yet"}
              </div>
            }
          >
            <For each={props.items}>{(item) => props.renderItem(item)}</For>
          </Show>
        </div>
      </div>
    </>
  );
};

type UngroupedSectionProps = Omit<SelectionSectionProps, "title">;

/** Selections without a group (ADR-0028). "Ungrouped" is not a real group,
 *  so its header has no rename / delete / copy / reveal actions. */
export const UngroupedSection: Component<UngroupedSectionProps> = (props) => (
  <div data-react-grab-ungrouped-section>
    <SelectionSection title="Ungrouped" {...props} />
  </div>
);
