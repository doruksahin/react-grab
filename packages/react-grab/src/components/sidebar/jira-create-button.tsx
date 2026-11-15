// packages/react-grab/src/components/sidebar/jira-create-button.tsx
import type { Component } from "solid-js";
import { Button } from "../ui/button.js";

interface JiraCreateButtonProps {
  onOpen: () => void;
}

export const JiraCreateButton: Component<JiraCreateButtonProps> = (props) => {
  return (
    <div
      class="p-3 border-t border-border shrink-0"
      style={{ "pointer-events": "auto" }}
    >
      <Button
        data-react-grab-jira-create
        class="w-full"
        style={{ "pointer-events": "auto" }}
        onClick={props.onOpen}
        data-testid="jira-create-button"
      >
        Create JIRA Ticket
      </Button>
    </div>
  );
};
