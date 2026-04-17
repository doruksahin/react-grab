import { type Component, Show } from "solid-js";
import { IssueTypeIcon } from "../sidebar/issue-type-icon.js";

interface JiraTicketLinkProps {
  ticketId: string;
  url?: string;
  issueType?: string | null;
}

export const JiraTicketLink: Component<JiraTicketLinkProps> = (props) => {
  return (
    <div class="flex items-center gap-1.5" data-react-grab-jira-ticket-link>
      <IssueTypeIcon issueType={props.issueType ?? undefined} />
      <Show
        when={props.url}
        fallback={
          <span class="font-mono text-[10px] text-muted-foreground">
            {props.ticketId}
          </span>
        }
      >
        <a
          href={props.url}
          target="_blank"
          rel="noopener noreferrer"
          class="font-mono text-[10px] text-blue-500 hover:text-blue-600 underline decoration-blue-500/40 hover:decoration-blue-600 transition-colors cursor-pointer"
        >
          {props.ticketId}
        </a>
      </Show>
    </div>
  );
};
