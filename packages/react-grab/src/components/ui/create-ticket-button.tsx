import type { Component } from 'solid-js';
import { cn } from '../../utils/cn.js';

interface CreateTicketButtonProps {
  onClick: () => void;
  class?: string;
}

/**
 * "+ Ticket" affordance for selections without a JIRA ticket.
 * Used in both the overlay selection label and the sidebar cards.
 */
export const CreateTicketButton: Component<CreateTicketButtonProps> = (
  props
) => {
  return (
    <button
      type="button"
      data-react-grab-ignore-events
      data-react-grab-create-ticket
      class={cn(
        'h-6 px-2.5 w-full text-[10px] font-medium rounded-md bg-transparent text-jira-create border border-jira-create/40 hover:bg-jira-create/10 cursor-pointer flex items-center justify-center gap-1',
        props.class
      )}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
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
    </button>
  );
};
