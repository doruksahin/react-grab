import type { Component } from "solid-js";
import { cn } from "../../utils/cn.js";
import { Button } from "../ui/button.js";

interface CreateTicketButtonProps {
  onClick: () => void;
  class?: string;
}

/**
 * "+ Ticket" affordance for selections without a Jira ticket, used by the
 * overlay selection label and the sidebar cards.
 */
export const CreateTicketButton: Component<CreateTicketButtonProps> = (
  props,
) => (
  <Button
    type="button"
    variant="outline"
    size="xs"
    data-react-grab-ignore-events
    data-react-grab-create-ticket
    class={cn("w-full", props.class)}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => {
      event.stopPropagation();
      props.onClick();
    }}
  >
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 2v12M2 8h12"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
    Ticket
  </Button>
);
