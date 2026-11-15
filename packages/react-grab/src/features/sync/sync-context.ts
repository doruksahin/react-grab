import { createContext, useContext, type Accessor } from "solid-js";
import type { JiraPort, StorageAdapter } from "./types.js";

/** What the overlay's UI needs from sync: the server ports and the Jira state they feed. */
export interface SyncContextValue {
  /** Null while there is no connection to the server. */
  storage: Accessor<StorageAdapter | null>;
  /** Null when sync is off. */
  jira: Accessor<JiraPort | null>;
  jiraProjectKey: Accessor<string | null>;
  /** Fetches one group's Jira status into the sync store. */
  refreshJiraStatus: (groupId: string) => Promise<void>;
}

const SyncContext = createContext<SyncContextValue>({
  storage: () => null,
  jira: () => null,
  jiraProjectKey: () => null,
  refreshJiraStatus: async () => {},
});

export const SyncProvider = SyncContext.Provider;

export const useSyncContext = (): SyncContextValue => useContext(SyncContext);
