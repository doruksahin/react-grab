// packages/react-grab/src/components/sidebar/jira-create-dialog.tsx
import { type Component, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { useShadowRoot } from "../../features/sidebar/shadow-context.js";
import { JiraCreateForm } from "./jira-create-form.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
import type { CommentItem } from "../../types.js";

interface JiraCreateDialogProps {
  open: boolean;
  workspaceId: string;
  groupId: string;
  group: SelectionGroupWithJira;
  commentItems: CommentItem[];
  onTicketCreated: (groupId: string, ticketId: string, ticketUrl: string) => void;
  onClose: () => void;
}

export const JiraCreateDialog: Component<JiraCreateDialogProps> = (props) => {
  const shadowRoot = useShadowRoot();

  return (
    <Show when={props.open}>
      <Portal mount={shadowRoot ?? document.body}>
        {/* Backdrop */}
        <div
          class="fixed inset-0 bg-black/60"
          style={{
            "z-index": "10000",
            "pointer-events": "auto",
          }}
          onClick={props.onClose}
        />
        {/* Dialog panel */}
        <div
          class="fixed inset-0 flex items-center justify-center"
          style={{ "z-index": "10001", "pointer-events": "none" }}
        >
          <div
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
              onSuccess={props.onTicketCreated}
              onClose={props.onClose}
            />
          </div>
        </div>
      </Portal>
    </Show>
  );
};
