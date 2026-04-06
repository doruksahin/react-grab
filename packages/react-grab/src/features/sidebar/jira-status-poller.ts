import { onCleanup, onMount } from "solid-js";
import type { SelectionGroupWithJira } from "./jira-types.js";
import { getJiraTicketStatus, type GetJiraTicketStatus200 } from "../../generated/sync-api.js";

const POLL_INTERVAL_MS = 30_000;

/**
 * SolidJS primitive that polls JIRA status for all ticketed groups.
 * Runs immediately on mount, then every 30 seconds.
 * Must be called within a reactive owner (component or root).
 */
export function createJiraStatusPoller(deps: {
  groups: () => SelectionGroupWithJira[];
  syncWorkspace: () => string | undefined;
  onStatusUpdate: (groupId: string, status: GetJiraTicketStatus200) => void;
}) {
  onMount(() => {
    const workspace = deps.syncWorkspace();
    if (!workspace) return;

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
    onCleanup(() => clearInterval(intervalId));
  });
}
