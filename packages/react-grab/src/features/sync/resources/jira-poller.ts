import { createResource, createMemo, onCleanup } from "solid-js";
import { getJiraTicketStatus } from "../../../generated/sync-api.js";
import type { SyncStoreHandle } from "../store/sync-store.js";

const POLL_INTERVAL_MS = 30_000;

export const createJiraPoller = (store: SyncStoreHandle) => {
  const ticketedGroups = createMemo(() =>
    store.store.groups.filter((g) => g.jiraTicketId),
  );

  const [resource, { refetch }] = createResource(
    () => {
      const workspace = store.store.workspace;
      const tg = ticketedGroups();
      return workspace && tg.length > 0 ? { workspace, groups: tg } : false;
    },
    async ({ workspace, groups }) => {
      await Promise.allSettled(
        groups.map(async (g) => {
          try {
            const result = await getJiraTicketStatus(workspace, g.id);
            if (result.status === 200) {
              store.updateJiraStatus(g.id, result.data);
            }
          } catch {
            // Silent per SPEC-003
          }
        }),
      );
    },
  );

  const intervalId = setInterval(() => {
    if (ticketedGroups().length > 0) refetch();
  }, POLL_INTERVAL_MS);
  onCleanup(() => clearInterval(intervalId));

  return { resource, refetch, ticketedGroups };
};
