import { initSync } from "react-grab/core";
import type { SiteSettings } from "../settings/types.js";
import {
  createMessagingJiraPort,
  createMessagingStorageAdapter,
} from "./messaging-ports.js";

export const startSync = (site: SiteSettings): Promise<void> =>
  initSync({
    enabled: true,
    workspace: site.workspace,
    jiraProjectKey: site.jiraProjectKey,
    storage: createMessagingStorageAdapter(),
    jira: createMessagingJiraPort(),
    syncRevealedState: true,
    onSyncError: (error) => {
      console.warn("[react-grab extension] sync error:", error.message);
    },
  });
