// packages/react-grab/src/components/selection-label/create-ticket-button.tsx
import type { Component } from 'solid-js';

interface CreateTicketButtonProps {
  onClick: () => void;
}

/**
 * "+ Create ticket" affordance rendered inside the selection label
 * (below the ActiveGroupPicker) when the selection has no JIRA ticket
 * yet. Opens the JiraCreateDialog via the per-instance callback wired
 * up in `renderer.tsx`.
 */
export const CreateTicketButton: Component<CreateTicketButtonProps> = (
  props,
) => {
  return (
    <button
      type="button"
      data-react-grab-ignore-events
      class="h-6 px-2 text-[10px] font-medium rounded-md bg-transparent text-popover-foreground border border-dashed border-border hover:bg-accent cursor-pointer self-stretch mx-2"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        props.onClick();
      }}
    >
      + Create ticket
    </button>
  );
};
