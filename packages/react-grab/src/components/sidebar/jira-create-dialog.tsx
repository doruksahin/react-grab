import { type Component } from "solid-js";
import { Portal } from "solid-js/web";
import { JiraCreateForm } from "./jira-create-form.js";
import type { SelectionGroup } from "../../features/selection-groups/types.js";
import type { CommentItem, TicketCreatedCallback } from "../../types.js";
import { useShadowMount } from "../../utils/shadow-context.js";

interface JiraCreateDialogProps {
  groupId: string;
  group: SelectionGroup;
  commentItems: CommentItem[];
  jiraProjectKey: string;
  /** Host of the Jira site (GET /jira/site), when the sync server reports it. */
  jiraSiteHost?: string;
  onTicketCreated: TicketCreatedCallback;
  onClose: () => void;
}

export const JiraCreateDialog: Component<JiraCreateDialogProps> = (props) => {
  return (
    <Portal mount={useShadowMount()}>
      <div
        class="fixed inset-0 flex items-center justify-center"
        style={{ "z-index": "var(--z-dialog)", "pointer-events": "auto" }}
        onClick={props.onClose}
      >
        <div class="absolute inset-0 bg-black/60" />
        <div
          data-react-grab-jira-dialog
          class="w-[580px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-border bg-card shadow-bulk-bar"
          style={{ "pointer-events": "auto" }}
          role="dialog"
          aria-modal="true"
          aria-label="Create JIRA Ticket"
          onClick={(e) => e.stopPropagation()}
        >
          <JiraCreateForm
            groupId={props.groupId}
            group={props.group}
            commentItems={props.commentItems}
            jiraProjectKey={props.jiraProjectKey}
            jiraSiteHost={props.jiraSiteHost}
            onSuccess={props.onTicketCreated}
            onClose={props.onClose}
          />
        </div>
      </div>
    </Portal>
  );
};
