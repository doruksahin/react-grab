// packages/react-grab/src/components/sidebar/group-detail-view.tsx
import { type Component, Show } from "solid-js";
import type { CommentItem } from "../../types.js";
import { DetailHeader } from "./detail-header.js";
import { SelectionList } from "./selection-list.js";
import { JiraCreateButton } from "./jira-create-button.js";
import { getStatusLabel } from "../../features/sidebar/status-colors.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";

interface GroupDetailViewProps {
  ref?: (el: HTMLDivElement) => void;
  group: SelectionGroupWithJira;
  commentItems: CommentItem[];
  syncServerUrl?: string;
  syncWorkspace?: string;
  onBack: () => void;
  /** Bubble the "Create JIRA Ticket" intent up to the Sidebar so the dialog
   *  can be mounted there via the same on-demand pattern the loose flow
   *  uses. The Sidebar owns dialog state for both flows; GroupDetailView
   *  just signals intent. */
  onCreateTicket?: (
    group: SelectionGroupWithJira,
    items: CommentItem[],
  ) => void;
}

export const GroupDetailView: Component<GroupDetailViewProps> = (props) => {
  const groupItems = () =>
    props.commentItems.filter((c) => c.groupId === props.group.id);

  const statusLabel = () => getStatusLabel(props.group);

  return (
    <div
      data-react-grab-group-detail
      tabIndex={-1}
      ref={props.ref}
      class="flex flex-col flex-1 overflow-hidden outline-none"
      style={{ "pointer-events": "auto" }}
      aria-label={`Detail: ${props.group.name}`}
      role="region"
    >
      <DetailHeader group={props.group} onBack={props.onBack} />

      <SelectionList
        items={groupItems()}
        syncServerUrl={props.syncServerUrl}
        syncWorkspace={props.syncWorkspace}
      />

      {/* JIRA section — bottom of detail view */}
      <Show when={statusLabel() === "No Task"}>
        <JiraCreateButton
          onOpen={() => props.onCreateTicket?.(props.group, groupItems())}
        />
      </Show>
    </div>
  );
};
