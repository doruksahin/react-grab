import { createResource, type Resource } from "solid-js";
import { useSyncContext } from "../../sync/sync-context.js";
import type { JiraDestination } from "../../sync/types.js";

/**
 * Where the workspace's new tickets go and as whom, asked fresh each time the
 * dialog opens, so a destination changed in the settings shows at once
 * (ADR-0027).
 */
export const useJiraDestination = (): Resource<JiraDestination> => {
  const { jira } = useSyncContext();
  const [destination] = createResource(async () => {
    const port = jira();
    if (!port) throw new Error("Jira is not connected");
    return port.getDestination();
  });
  return destination;
};
