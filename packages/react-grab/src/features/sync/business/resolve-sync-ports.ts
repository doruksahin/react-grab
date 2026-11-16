import type {
  JiraPort,
  StorageAdapter,
  SyncConfig,
  SyncPortFactories,
} from "../types.js";

export interface ResolvedSyncPorts {
  /** Null when sync is off: the overlay then keeps everything in localStorage. */
  storage: StorageAdapter | null;
  jira: JiraPort | null;
}

/**
 * The ports for a sync config: the injected ones, and ones built by the
 * factories from `serverUrl`, `apiToken` and `workspace` for any that are
 * missing. Only a port that has to be built needs those fields (ADR-0020,
 * ADR-0023).
 */
export const resolveSyncPorts = (
  config: SyncConfig,
  factories: SyncPortFactories,
): ResolvedSyncPorts => {
  if (!config.enabled) {
    return { storage: null, jira: config.jira ?? null };
  }

  const { storage, jira } = config;
  if (storage && jira) return { storage, jira };

  if (!config.apiToken) {
    throw new Error(
      "react-grab: SyncConfig.apiToken is required when sync is enabled without injected ports — the sync server refuses requests without it (ADR-0020)",
    );
  }
  if (!config.serverUrl) {
    throw new Error(
      "react-grab: SyncConfig.serverUrl is required when sync is enabled without injected ports",
    );
  }

  const serverConfig = {
    serverUrl: config.serverUrl,
    apiToken: config.apiToken,
    workspace: config.workspace,
    ...(config.jiraProjectKey === undefined
      ? {}
      : { jiraProjectKey: config.jiraProjectKey }),
  };
  return {
    storage: storage ?? factories.createStorage(serverConfig),
    jira: jira ?? factories.createJira(serverConfig),
  };
};
