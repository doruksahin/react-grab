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
          <span class="font-mono text-meta text-muted-foreground">
            {props.ticketId}
          </span>
        }
      >
        <a
          href={props.url}
          target="_blank"
          rel="noopener noreferrer"
          class="font-mono text-meta text-ticket-link hover:text-ticket-link-hover underline decoration-ticket-link/40 hover:decoration-ticket-link-hover transition-colors cursor-pointer"
        >
          {props.ticketId}
        </a>
      </Show>
    </div>
  );
};
