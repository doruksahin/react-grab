import { type Component } from "solid-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog.js";
import { JiraCreateForm } from "./jira-create-form.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
import type { CommentItem, TicketCreatedCallback } from "../../types.js";

interface JiraCreateDialogProps {
  open: boolean;
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
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()} modal>
      {/* data-kb-theme="dark" is forwarded to the portal wrapper div inside DialogContent,
          which wraps BOTH the overlay and the content panel — so dark tokens apply to both. */}
      <DialogContent
        data-react-grab-jira-dialog
        data-kb-theme="dark"
        class="w-[480px] max-h-[80vh] overflow-y-auto bg-[var(--grab-dark-surface)] border-white/10"
        style={{ "z-index": "var(--z-dialog)" }}
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
