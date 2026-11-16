// packages/react-grab/src/components/sidebar/loose-selection-list.tsx
import { type Component, For, Show, createMemo } from "solid-js";
import type { CommentItem } from "../../types.js";
import type { SelectionGroupWithJira } from "../../features/selection-groups/types.js";
import { isPresentedAsLoose } from "../../features/selection-groups/business/membership.js";
import { getStatusChip } from "../../features/sidebar/get-status-chip.js";
import { LooseSelectionCard } from "./loose-selection-card.jsx";

interface LooseSelectionListProps {
  /** Full unfiltered groups list — needed for synthetic-group lookup. */
  allGroups: SelectionGroupWithJira[];
  /** Full unfiltered comment items list. */
  commentItems: CommentItem[];
  scrollRoot: () => Element | null;
  onCreateTicket: (item: CommentItem) => void;
  onRemoveItem?: (itemId: string) => void;
}

/**
 * Renders loose selections (genuinely ungrouped + synthetic-1-item) above
 * the GroupList. SRP: derives the loose list and forwards each item to
 * LooseSelectionCard along with the right Jira status data (looked up
 * from the backing synthetic group, when present).
 */
export const LooseSelectionList: Component<LooseSelectionListProps> = (
  props,
) => {
  const looseItems = createMemo(() =>
    props.commentItems.filter((item) =>
      isPresentedAsLoose(item, props.allGroups, props.commentItems),
    ),
  );

  // For a loose item that lives in a synthetic group, find that group so we
  // can read its Jira fields (jiraTicketId, jiraStatus, etc.) for the pill.
  const backingGroupFor = (item: CommentItem) =>
    item.groupId === null
      ? undefined
      : props.allGroups.find((g) => g.id === item.groupId);

  return (
    <Show when={looseItems().length > 0}>
      <div data-react-grab-loose-selection-list class="px-2 pt-2">
        <For each={looseItems()}>
          {(item) => {
            // Accessors — NOT plain consts. `<For>` runs this body
            // once per item, so anything stored in a const is frozen
            // at render time and never reacts to allGroups updates.
            // Wrapping in accessors lets Solid's JSX compiler track
            // the reads through the LooseSelectionCard prop getters.
            const group = () => backingGroupFor(item);
            return (
              <LooseSelectionCard
                item={item}
                status={getStatusChip(group() ?? {})}
                jiraTicketId={group()?.jiraTicketId}
                jiraUrl={group()?.jiraUrl}
                jiraFlagged={group()?.jiraFlagged}
                jiraFlaggedAt={group()?.jiraFlaggedAt}
                jiraFlaggedBy={group()?.jiraFlaggedBy}
                jiraFlaggedByAvatar={group()?.jiraFlaggedByAvatar}
                onCreateTicket={props.onCreateTicket}
                onRemoveItem={props.onRemoveItem}
                scrollRoot={props.scrollRoot}
              />
            );
          }}
        </For>
      </div>
    </Show>
  );
};
