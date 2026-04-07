// packages/react-grab/src/components/sidebar/jira-create-button.tsx
import type { Component } from "solid-js";

interface JiraCreateButtonProps {
  onOpen: () => void;
}

export const JiraCreateButton: Component<JiraCreateButtonProps> = (props) => {
  return (
    <div class="p-3 border-t border-border shrink-0" style={{ "pointer-events": "auto" }}>
      <button
        data-react-grab-jira-create
        class="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-medium rounded-lg transition-colors"
        style={{ "pointer-events": "auto" }}
        onClick={props.onOpen}
        data-testid="jira-create-button"
      >
        Create JIRA Ticket
      </button>
    </div>
  );
};
