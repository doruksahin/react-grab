import { type Component, For, Show } from "solid-js";
import type { CommentItem } from "../../types";
import { SelectionCard } from "./selection-card";
import { EmptyState } from "./empty-state";

interface SelectionListProps {
  items: CommentItem[];
  syncServerUrl?: string;
  syncWorkspace?: string;
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
              syncServerUrl={props.syncServerUrl}
              syncWorkspace={props.syncWorkspace}
              scrollRoot={() => scrollContainerRef ?? null}
            />
          )}
        </For>
      </div>
    </Show>
  );
};
