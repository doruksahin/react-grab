import { type Component, For, Show } from "solid-js";
import type { CommentItem } from "../../types.js";
import { SelectionCard } from "./selection-card.js";
import { EmptyState } from "./empty-state.js";

interface SelectionListProps {
  items: CommentItem[];
  /** Remove handler; a card shows × only when `canRemoveItem` allows it. */
  onRemoveItem?: (itemId: string) => void;
  /** The membership policy's answer; a selection with a ticket has no remove action. */
  canRemoveItem?: (itemId: string) => boolean;
  jiraFlagged?: boolean;
  jiraFlaggedAt?: string | null;
  jiraFlaggedBy?: string | null;
  jiraFlaggedByAvatar?: string | null;
}

export const SelectionList: Component<SelectionListProps> = (props) => {
  let scrollContainerRef: HTMLDivElement | undefined;

  return (
    <Show
      when={props.items.length > 0}
      fallback={
        <EmptyState
          message="No selections in this group."
          submessage="Add elements to this group using the toolbar."
        />
      }
    >
      <div
        data-react-grab-selection-list
        ref={scrollContainerRef}
        class="flex-1 overflow-y-auto px-3 py-2"
        style={{ "pointer-events": "auto" }}
      >
        <For each={props.items}>
          {(item) => (
            <SelectionCard
              item={item}
              scrollRoot={() => scrollContainerRef ?? null}
              onRemoveItem={
                props.onRemoveItem && props.canRemoveItem?.(item.id)
                  ? () => props.onRemoveItem?.(item.id)
                  : undefined
              }
              jiraFlagged={props.jiraFlagged}
              jiraFlaggedAt={props.jiraFlaggedAt}
              jiraFlaggedBy={props.jiraFlaggedBy}
              jiraFlaggedByAvatar={props.jiraFlaggedByAvatar}
            />
          )}
        </For>
      </div>
    </Show>
  );
};
