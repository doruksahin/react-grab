import type { Component } from "solid-js";
import { cn } from "../../utils/cn.js";
import { Button } from "../ui/button.js";
import { IconPlus } from "../icons/icon-plus.jsx";

interface CreateTicketButtonProps {
  onClick: () => void;
  class?: string;
}

/**
 * The main action of a selection without a Jira ticket, used by the overlay
 * selection label and the sidebar cards.
 */
export const CreateTicketButton: Component<CreateTicketButtonProps> = (
  props,
) => (
  <Button
    type="button"
    size="sm"
    data-react-grab-ignore-events
    data-react-grab-create-ticket
    class={cn("w-full", props.class)}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => {
      event.stopPropagation();
      props.onClick();
    }}
  >
    <IconPlus size={12} />
    Create Jira ticket
  </Button>
);
