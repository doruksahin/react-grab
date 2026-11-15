import type { Component } from "solid-js";
import { Button } from "../ui/button.js";

interface EmptyStateProps {
  message: string;
  submessage?: string;
  action?: { label: string; onClick: () => void };
}

export const EmptyState: Component<EmptyStateProps> = (props) => {
  return (
    <div
      data-react-grab-empty-state
      class="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      <p class="text-sm text-foreground">{props.message}</p>
      {props.submessage && (
        <p class="text-xs text-muted-foreground mt-1">{props.submessage}</p>
      )}
      {props.action && (
        <Button
          variant="secondary"
          size="xs"
          class="mt-3"
          onClick={props.action.onClick}
        >
          {props.action.label}
        </Button>
      )}
    </div>
  );
};
