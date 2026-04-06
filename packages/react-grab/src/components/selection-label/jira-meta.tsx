import { type Component, Show, For } from "solid-js";
import type { SelectionLabelInstance } from "../../types.js";
import { getStatusColor } from "../../features/sidebar/status-colors.js";
import { UserAvatar } from "../sidebar/UserAvatar.js";

type JiraMetaProps = Required<Pick<SelectionLabelInstance, "jiraTicketId">> &
  Pick<SelectionLabelInstance, "jiraUrl" | "jiraAssignee" | "jiraReporter" | "jiraAssigneeAvatar" | "jiraReporterAvatar"> & {
    jiraStatus?: string;
    labels?: string[];
  };

export const JiraMeta: Component<JiraMetaProps> = (props) => (
  <div data-react-grab-jira-meta class="flex flex-col w-full mb-1 gap-0.5">
    <div class="flex gap-2 items-center w-full overflow-hidden">
      <a
        href={props.jiraUrl ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        data-react-grab-ignore-events
        class="text-[10px] font-semibold text-blue-500 hover:text-blue-400 transition-colors shrink-0"
        style={{ "pointer-events": "auto" }}
        onClick={(e) => e.stopImmediatePropagation()}
      >
        {props.jiraTicketId}
      </a>
      <Show when={props.jiraStatus}>
        {(status) => (
          <span
            class="text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0"
            style={{
              background: getStatusColor(status()).bg,
              color: getStatusColor(status()).text,
            }}
          >
            {status()}
          </span>
        )}
      </Show>
      <Show when={props.jiraAssignee}>
        <span class="flex items-center gap-1 text-[10px] text-black/40 truncate">
          <UserAvatar
            avatarUrl={props.jiraAssigneeAvatar}
            displayName={props.jiraAssignee}
            size={14}
          />
          {props.jiraAssignee}
        </span>
      </Show>
      <Show when={props.jiraReporter}>
        <span class="flex items-center gap-1 text-[10px] text-black/30 truncate">
          <UserAvatar
            avatarUrl={props.jiraReporterAvatar}
            displayName={props.jiraReporter}
            size={14}
          />
          {props.jiraReporter}
        </span>
      </Show>
    </div>
    <Show when={props.labels?.length}>
      <div class="flex flex-wrap gap-1">
        <For each={props.labels}>
          {(lbl) => (
            <span class="text-[8px] px-1 py-0.5 rounded-full bg-black/10 text-black/40">
              {lbl}
            </span>
          )}
        </For>
      </div>
    </Show>
  </div>
);
