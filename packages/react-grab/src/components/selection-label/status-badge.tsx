import { type Component, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { getStatusColor } from "../../features/sidebar/status-colors.js";
import { IconCheck } from "../icons/icon-check.js";
import { IconTicket } from "../icons/icon-ticket.js";
import type { SelectionLabelInstance } from "../../types.js";

type StatusBadgeProps = Pick<SelectionLabelInstance, "groupStatus" | "jiraTicketId" | "jiraUrl">;

const StatusIcon: Component<{ groupStatus?: string; jiraTicketId?: string }> = (props) => {
  const isDone = () => props.groupStatus === "Done" || props.groupStatus === "Won't Do";
  const isTicketed = () => props.groupStatus || props.jiraTicketId;

  return (
    <Show when={isTicketed()}>
      <Show when={isDone()} fallback={<IconTicket size={12} class="text-white" />}>
        <IconCheck size={12} class="text-white" />
      </Show>
    </Show>
  );
};

export const SelectionStatusBadge: Component<StatusBadgeProps> = (props) => {
  const tag = () => (props.jiraUrl ? "a" : "div");
  const isClickable = () => !!props.jiraUrl;

  const linkProps = () =>
    isClickable()
      ? {
          href: props.jiraUrl,
          target: "_blank",
          rel: "noopener noreferrer",
          title: `${props.groupStatus ?? "No Task"} — ${props.jiraTicketId} (click to open)`,
          onClick: (e: MouseEvent) => e.stopPropagation(),
        }
      : {
          title: props.groupStatus ?? "No Task",
        };

  return (
    <Show when={props.groupStatus || props.jiraTicketId}>
      <Dynamic
        component={tag()}
        data-react-grab-ignore-events
        data-react-grab-status-badge={props.groupStatus ?? "no-task"}
        class={`absolute -top-3.5 -right-3 w-[22px] h-[22px] rounded-[6px] flex items-center justify-center border-2 border-white${isClickable() ? " cursor-pointer hover:scale-110 transition-transform" : ""}`}
        style={{
          background: getStatusColor(props.groupStatus).hex,
          "pointer-events": "auto",
        }}
        {...linkProps()}
      >
        <StatusIcon groupStatus={props.groupStatus} jiraTicketId={props.jiraTicketId} />
      </Dynamic>
    </Show>
  );
};
