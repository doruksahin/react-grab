import type { Component } from 'solid-js';
import { CreateTicketButton as BaseCreateTicketButton } from '../ui/create-ticket-button.jsx';

interface CreateTicketButtonProps {
  onClick: () => void;
  class?: string;
}

/**
 * Overlay-specific wrapper — adds `self-stretch` layout class
 * needed for the selection label's prompt-mode column layout.
 */
export const CreateTicketButton: Component<CreateTicketButtonProps> = (
  props
) => {
  return (
    <BaseCreateTicketButton onClick={props.onClick} class={`self-stretch ${props.class ?? ""}`} />
  );
};
