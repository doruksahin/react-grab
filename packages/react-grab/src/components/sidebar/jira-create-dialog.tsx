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
      <DialogContent
        data-react-grab-jira-dialog
        class="w-[480px] max-h-[80vh] overflow-y-auto bg-card border-border"
        style={{ "z-index": "var(--z-dialog)" }}
      >
        <DialogHeader>
          <DialogTitle class="text-foreground">Create JIRA Ticket</DialogTitle>
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
