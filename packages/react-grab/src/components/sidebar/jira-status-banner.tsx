// packages/react-grab/src/components/sidebar/jira-status-banner.tsx
import { type Component } from "solid-js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
import { JiraProgressDots } from "./jira-progress-dots.js";

interface JiraStatusBannerProps {
  group: SelectionGroupWithJira;
}

export const JiraStatusBanner: Component<JiraStatusBannerProps> = (props) => {
  return (
    <div
      data-react-grab-jira-status
      class="m-3 p-3 rounded-lg bg-muted border border-border shrink-0"
      style={{ "pointer-events": "auto" }}
    >
      <div class="flex items-center justify-between mb-1">
        <a
          href={props.group.jiraUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          class="text-[12px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          style={{ "pointer-events": "auto" }}
        >
          {props.group.jiraTicketId}
        </a>
        <span class="text-[10px] text-muted-foreground">
          {props.group.jiraStatus ?? "—"}
        </span>
      </div>
      <JiraProgressDots statusCategory={props.group.jiraStatusCategory} />
    </div>
  );
};
