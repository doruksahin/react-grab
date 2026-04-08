// packages/react-grab/src/components/sidebar/loose-selection-list.tsx
import { type Component, For, Show, createMemo } from "solid-js";
import type { CommentItem } from "../../types.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
import { isPresentedAsLoose } from "../../features/selection-groups/business/membership.js";
import { getStatusColor, getStatusLabel } from "../../features/sidebar/status-colors.js";
import { LooseSelectionCard } from "./loose-selection-card.jsx";

interface LooseSelectionListProps {
  /** Full unfiltered groups list — needed for synthetic-group lookup. */
  allGroups: SelectionGroupWithJira[];
  /** Full unfiltered comment items list. */
  commentItems: CommentItem[];
  syncServerUrl?: string;
  syncWorkspace?: string;
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
export const LooseSelectionList: Component<LooseSelectionListProps> = (props) => {
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
            const group = backingGroupFor(item);
            const statusLabel = group ? getStatusLabel(group) : "No Task";
            const statusColor = getStatusColor(group?.jiraStatus);
            return (
              <LooseSelectionCard
                item={item}
                statusLabel={statusLabel}
                statusColor={statusColor}
                jiraTicketId={group?.jiraTicketId}
                jiraUrl={group?.jiraUrl}
                onCreateTicket={props.onCreateTicket}
                onRemoveItem={props.onRemoveItem}
                syncServerUrl={props.syncServerUrl}
                syncWorkspace={props.syncWorkspace}
                scrollRoot={props.scrollRoot}
              />
            );
          }}
        </For>
      </div>
    </Show>
  );
};
