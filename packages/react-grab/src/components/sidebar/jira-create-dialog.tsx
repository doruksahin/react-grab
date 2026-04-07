import { type Component } from "solid-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog.js";
import { JiraCreateForm } from "./jira-create-form.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
import type { CommentItem } from "../../types.js";

interface JiraCreateDialogProps {
  open: boolean;
  workspaceId: string;
  groupId: string;
  group: SelectionGroupWithJira;
  commentItems: CommentItem[];
  jiraProjectKey: string;
  /** @deprecated Portal now auto-mounts via ShadowRootContext — no longer needed. */
  shadowRoot?: ShadowRoot | null;
  onTicketCreated: (groupId: string, ticketId: string, ticketUrl: string) => void;
  onClose: () => void;
}

export const JiraCreateDialog: Component<JiraCreateDialogProps> = (props) => {
  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()} modal>
      {/* data-kb-theme="dark" is forwarded to the portal wrapper div inside DialogContent,
          which wraps BOTH the overlay and the content panel — so dark tokens apply to both. */}
      <DialogContent
        data-react-grab-jira-dialog
        data-kb-theme="dark"
        class="w-[480px] max-h-[80vh] overflow-y-auto bg-[#1a1a1a] border-white/10"
        style={{ "z-index": "2147483647" }}
      >
        <DialogHeader>
          <DialogTitle class="text-white">Create JIRA Ticket</DialogTitle>
        </DialogHeader>
        <JiraCreateForm
          workspaceId={props.workspaceId}
          groupId={props.groupId}
          group={props.group}
          commentItems={props.commentItems}
          jiraProjectKey={props.jiraProjectKey}
          onSuccess={props.onTicketCreated}
          onClose={props.onClose}
        />
      </DialogContent>
    </Dialog>
  );
};
