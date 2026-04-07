// packages/react-grab/src/components/sidebar/group-detail-view.tsx
import {
  type Component,
  createSignal,
  Show,
} from "solid-js";
import type { CommentItem, TicketCreatedCallback } from "../../types.js";
import { DetailHeader } from "./detail-header.js";
import { SelectionList } from "./selection-list.js";
import { JiraCreateButton } from "./jira-create-button.js";
import { JiraCreateDialog } from "./jira-create-dialog.js";
import { getStatusLabel } from "../../features/sidebar/status-colors.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";

interface GroupDetailViewProps {
  ref?: (el: HTMLDivElement) => void;
  group: SelectionGroupWithJira;
  commentItems: CommentItem[];
  syncServerUrl?: string;
  syncWorkspace?: string;
  jiraProjectKey?: string;
  onBack: () => void;
  onTicketCreated?: TicketCreatedCallback;
}

export const GroupDetailView: Component<GroupDetailViewProps> = (props) => {
  const [dialogOpen, setDialogOpen] = createSignal(false);

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
        <JiraCreateButton onOpen={() => setDialogOpen(true)} />
        <JiraCreateDialog
          open={dialogOpen()}
          workspaceId={props.syncWorkspace ?? ""}
          groupId={props.group.id}
          group={props.group}
          commentItems={groupItems()}
          jiraProjectKey={props.jiraProjectKey ?? ""}
          onTicketCreated={(groupId, ticketId, ticketUrl) => {
            props.onTicketCreated?.(groupId, ticketId, ticketUrl);
          }}
          onClose={() => setDialogOpen(false)}
        />
      </Show>
    </div>
  );
};
