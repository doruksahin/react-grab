import { createContext, useContext, type Accessor } from "solid-js";
import type { JiraPort, StorageAdapter } from "./types.js";

/** The server ports for the overlay's UI; null while there is no connection. */
export interface SyncPorts {
  storage: Accessor<StorageAdapter | null>;
  jira: Accessor<JiraPort | null>;
}

const SyncPortsContext = createContext<SyncPorts>({
  storage: () => null,
  jira: () => null,
});

export const SyncPortsProvider = SyncPortsContext.Provider;

export const useSyncPorts = (): SyncPorts => useContext(SyncPortsContext);
