import type { Component } from "solid-js";
import type { SelectionGroupWithJira } from "../../features/selection-groups/types.js";
import { getStatusChip } from "../../features/sidebar/get-status-chip.js";
import { StatusChip } from "../ui/status-chip.jsx";
import { IconButton } from "../ui/icon-button.js";

interface GroupTicketSummaryProps {
  group: SelectionGroupWithJira;
  onOpenDetail: () => void;
}

/**
 * The sidebar's addition to a group header in the selection tree
 * (ADR-0028): the group's status and the way into its detail view. The
 * ticket key is on every card under the header.
 */
export const GroupTicketSummary: Component<GroupTicketSummaryProps> = (
  props,
) => (
  <span
    data-react-grab-group-ticket-summary={props.group.id}
    class="flex items-center gap-1.5"
  >
    <StatusChip {...getStatusChip(props.group)} />
    <IconButton
      data-react-grab-ignore-events
      label="Open detail view"
      size="icon-xs"
      on:click={(event) => {
        event.stopPropagation();
        props.onOpenDetail();
      }}
      on:pointerdown={(event) => event.stopPropagation()}
    >
      <svg viewBox="0 0 16 16" class="w-2.5 h-2.5">
        <path
          fill="currentColor"
          d="m6.03 1.47 6 6a.75.75 0 0 1 .052 1.004l-.052.056-6 6-1.06-1.06L10.44 8 4.97 2.53z"
        />
      </svg>
    </IconButton>
  </span>
);
