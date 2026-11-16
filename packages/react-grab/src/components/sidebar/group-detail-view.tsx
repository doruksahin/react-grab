// packages/react-grab/src/components/sidebar/group-detail-view.tsx
import { type Component, Show } from "solid-js";
import type { CommentItem } from "../../types.js";
import { DetailHeader } from "./detail-header.js";
import { SelectionList } from "./selection-list.js";
import { JiraCreateButton } from "./jira-create-button.js";
import { Button } from "../ui/button.js";
import { IconArchive } from "../icons/icon-archive.jsx";
import { archiveLabel } from "../selection/archive-labels.js";
import { canArchive } from "../../features/selection-groups/business/archive-policy.js";
import { getStatusLabel } from "../../features/sidebar/status-colors.js";
import type { SelectionGroupWithJira } from "../../features/selection-groups/types.js";

interface GroupDetailViewProps {
  ref?: (el: HTMLDivElement) => void;
  group: SelectionGroupWithJira;
  commentItems: CommentItem[];
  onBack: () => void;
  /** Bubble the "Create JIRA Ticket" intent up to the Sidebar so the dialog
   *  can be mounted there via the same on-demand pattern the loose flow
   *  uses. The Sidebar owns dialog state for both flows; GroupDetailView
   *  just signals intent. */
  onCreateTicket?: (
    group: SelectionGroupWithJira,
    items: CommentItem[],
  ) => void;
  onRemoveItem?: (itemId: string) => void;
  canRemoveItem?: (itemId: string) => boolean;
  /** Archives the whole group with its ticket (ADR-0030). */
  onArchive?: (groupId: string) => void;
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
        onRemoveItem={props.onRemoveItem}
        canRemoveItem={props.canRemoveItem}
        jiraFlagged={props.group.jiraFlagged}
        jiraFlaggedAt={props.group.jiraFlaggedAt}
        jiraFlaggedBy={props.group.jiraFlaggedBy}
        jiraFlaggedByAvatar={props.group.jiraFlaggedByAvatar}
      />

      {/* JIRA section — bottom of detail view */}
      <Show when={statusLabel() === "No Task"}>
        <JiraCreateButton
          onOpen={() => props.onCreateTicket?.(props.group, groupItems())}
        />
      </Show>
      {/* A ticketed group is archived as a whole: its comments share one ticket. */}
      <Show when={props.onArchive && canArchive(props.group)}>
        <div class="shrink-0 border-t border-border p-3">
          <Button
            data-react-grab-ignore-events
            data-react-grab-group-detail-archive
            type="button"
            variant="outline"
            size="sm"
            class="w-full"
            onClick={() => props.onArchive?.(props.group.id)}
          >
            <IconArchive size={12} />
            {archiveLabel(props.group, groupItems().length)}
          </Button>
        </div>
      </Show>
    </div>
  );
};
