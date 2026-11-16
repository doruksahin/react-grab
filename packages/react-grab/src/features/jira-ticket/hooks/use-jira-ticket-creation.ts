import { createResource, type Resource } from "solid-js";
import { useSyncContext } from "../../sync/sync-context.js";
import type {
  CreatedJiraTicket,
  JiraIssueType,
  JiraPort,
  JiraPriority,
  JiraTicketDraft,
} from "../../sync/types.js";

export interface JiraTicketCreation {
  issueTypes: Resource<JiraIssueType[]>;
  priorities: Resource<JiraPriority[]>;
  /** The project's labels; empty when they cannot be loaded, since labels are optional. */
  labels: Resource<string[]>;
  createTicket: (
    groupId: string,
    ticket: JiraTicketDraft,
  ) => Promise<CreatedJiraTicket>;
}

/**
 * The field options and the submit of the create-ticket dialog, through the
 * Jira port. The workspace's destination decides the project (ADR-0027).
 */
export const useJiraTicketCreation = (): JiraTicketCreation => {
  const { jira } = useSyncContext();
  const requireJira = (): JiraPort => {
    const port = jira();
    if (!port) throw new Error("Jira is not connected");
    return port;
  };

  // Async, so a missing port rejects the resource instead of throwing during setup.
  const [issueTypes] = createResource(async () =>
    requireJira().listIssueTypes(),
  );
  const [priorities] = createResource(async () =>
    requireJira().listPriorities(),
  );
  const [labels] = createResource(async (): Promise<string[]> => {
    try {
      return await requireJira().listLabels();
    } catch {
      return [];
    }
  });

  return {
    issueTypes,
    priorities,
    labels,
    createTicket: async (groupId, ticket) =>
      requireJira().createTicket(groupId, ticket),
  };
};
