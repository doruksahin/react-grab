import { type Component } from "solid-js";
import { Portal } from "solid-js/web";
import { JiraCreateForm } from "./jira-create-form.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
import type { CommentItem, TicketCreatedCallback } from "../../types.js";
import { useShadowMount } from "../../utils/shadow-context.js";

interface JiraCreateDialogProps {
  workspaceId: string;
  groupId: string;
  group: SelectionGroupWithJira;
  commentItems: CommentItem[];
  jiraProjectKey: string;
  onTicketCreated: TicketCreatedCallback;
  onClose: () => void;
}

export const JiraCreateDialog: Component<JiraCreateDialogProps> = (props) => {
  return (
    <Portal mount={useShadowMount()}>
      <div
        class="fixed inset-0 flex items-center justify-center"
        style={{ "z-index": "2147483647", "pointer-events": "auto" }}
        onClick={props.onClose}
      >
        <div class="absolute inset-0 bg-black/60" />
        <div
          data-react-grab-jira-dialog
          class="bg-[#1a1a1a] rounded-xl w-[480px] max-h-[80vh] overflow-y-auto p-6 border border-white/10"
          style={{ "pointer-events": "auto" }}
          role="dialog"
          aria-modal="true"
          aria-label="Create JIRA Ticket"
          onClick={(e) => e.stopPropagation()}
        >
          <JiraCreateForm
            workspaceId={props.workspaceId}
            groupId={props.groupId}
            group={props.group}
            commentItems={props.commentItems}
            jiraProjectKey={props.jiraProjectKey}
            onSuccess={props.onTicketCreated}
            onClose={props.onClose}
          />
        </div>
      </div>
    </Portal>
  );
};
