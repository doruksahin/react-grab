// packages/react-grab/src/components/sidebar/group-detail-view.tsx
import {
  type Component,
  createSignal,
  Match,
  onCleanup,
  onMount,
  Switch,
} from "solid-js";
import type { CommentItem } from "../../types.js";
import { DetailHeader } from "./detail-header.js";
import { SelectionList } from "./selection-list.js";
import { JiraCreateButton } from "./jira-create-button.js";
import { JiraCreateDialog } from "./jira-create-dialog.js";
import { JiraStatusBanner } from "./jira-status-banner.js";
import { getStatusLabel } from "../../features/sidebar/status-colors.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
import { getJiraTicketStatus, type GetJiraTicketStatus200 } from "../../generated/sync-api.js";

interface GroupDetailViewProps {
  ref?: (el: HTMLDivElement) => void;
  group: SelectionGroupWithJira;
  commentItems: CommentItem[];
  syncServerUrl?: string;
  syncWorkspace?: string;
  /** Shadow root for Portal mounting in JiraCreateDialog. Passed explicitly
   *  to avoid context timing issues (context value may be null on first render). */
  shadowRoot?: ShadowRoot | null;
  onBack: () => void;
  onTicketCreated?: (groupId: string, ticketId: string, ticketUrl: string) => void;
  onStatusUpdate?: (
    groupId: string,
    status: GetJiraTicketStatus200,
  ) => void;
}

export const GroupDetailView: Component<GroupDetailViewProps> = (props) => {
  const [dialogOpen, setDialogOpen] = createSignal(false);

  const groupItems = () =>
    props.commentItems.filter((c) => c.groupId === props.group.id);

  const statusLabel = () => getStatusLabel(props.group);

  // Poll JIRA status every 30s when group is ticketed.
  // Starts immediately on mount; stops on unmount.
  onMount(() => {
    if (!props.group.jiraTicketId) return;
    if (!props.syncWorkspace) return;

    const poll = async () => {
      try {
        const result = await getJiraTicketStatus(
          props.syncWorkspace!,
          props.group.id,
        );
        if (result.status === 200) {
          props.onStatusUpdate?.(props.group.id, result.data);
        }
      } catch {
        // Silent — poll failures do not show errors per SPEC-003
      }
    };

    poll(); // immediate first poll
    const intervalId = setInterval(poll, 30_000);
    onCleanup(() => clearInterval(intervalId));
  });

  return (
    <div
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
      <Switch>
        <Match when={statusLabel() === "No Task"}>
          <JiraCreateButton onOpen={() => setDialogOpen(true)} />
          <JiraCreateDialog
            open={dialogOpen()}
            workspaceId={props.syncWorkspace ?? ""}
            groupId={props.group.id}
            group={props.group}
            commentItems={groupItems()}
            shadowRoot={props.shadowRoot}
            onTicketCreated={(groupId, ticketId, ticketUrl) => {
              props.onTicketCreated?.(groupId, ticketId, ticketUrl);
            }}
            onClose={() => setDialogOpen(false)}
          />
        </Match>
        <Match when={props.group.jiraTicketId}>
          <JiraStatusBanner group={props.group} />
        </Match>
      </Switch>
    </div>
  );
};
