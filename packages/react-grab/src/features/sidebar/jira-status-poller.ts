import type { SelectionGroupWithJira } from "./jira-types.js";
import { getJiraTicketStatus, type GetJiraTicketStatus200 } from "../../generated/sync-api.js";

const POLL_INTERVAL_MS = 30_000;

/**
 * Polls JIRA status for all ticketed groups.
 * Runs immediately, then every 30 seconds.
 * Returns a cleanup function to stop polling.
 * Does NOT require a component render context (no onMount).
 */
export function createJiraStatusPoller(deps: {
  groups: () => SelectionGroupWithJira[];
  syncWorkspace: () => string | undefined;
  onStatusUpdate: (groupId: string, status: GetJiraTicketStatus200) => void;
}): () => void {
  const workspace = deps.syncWorkspace();
  if (!workspace) return () => {};

  const pollAllTicketed = async () => {
    const ticketed = deps.groups().filter((g) => g.jiraTicketId);
    await Promise.allSettled(
      ticketed.map(async (g) => {
        try {
          const result = await getJiraTicketStatus(workspace, g.id);
          if (result.status === 200) {
            deps.onStatusUpdate(g.id, result.data);
          }
        } catch {
          // Silent — poll failures do not show errors per SPEC-003
        }
      }),
    );
  };

  pollAllTicketed();
  const intervalId = setInterval(pollAllTicketed, POLL_INTERVAL_MS);
  return () => clearInterval(intervalId);
}
