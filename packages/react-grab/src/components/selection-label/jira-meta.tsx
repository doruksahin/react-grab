import { type Component, Show, For } from "solid-js";
import type { SelectionLabelInstance } from "../../types.js";

type JiraMetaProps = Required<Pick<SelectionLabelInstance, "jiraTicketId">> &
  Pick<SelectionLabelInstance, "jiraUrl" | "jiraAssignee" | "jiraReporter"> & {
    labels?: string[];
  };

export const JiraMeta: Component<JiraMetaProps> = (props) => (
  <div data-react-grab-jira-meta class="flex gap-2 items-center w-full mb-1 overflow-hidden">
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
    <Show when={props.jiraAssignee}>
      <span class="text-[10px] text-black/40 truncate">
        👤 {props.jiraAssignee}
      </span>
    </Show>
    <Show when={props.jiraReporter}>
      <span class="text-[10px] text-black/30 truncate">
        ✏️ {props.jiraReporter}
      </span>
    </Show>
    <For each={props.labels}>
      {(lbl) => (
        <span class="text-[8px] px-1 py-0.5 rounded-full bg-black/10 text-black/40">
          {lbl}
        </span>
      )}
    </For>
  </div>
);
