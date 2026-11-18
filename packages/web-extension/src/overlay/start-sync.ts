import { initSync } from "react-grab/core";
import type { JiraUserIdentity, SiteSettings } from "../settings/types.js";
import {
  createMessagingJiraPort,
  createMessagingStorageAdapter,
} from "./messaging-ports.js";

export const startSync = (
  site: SiteSettings,
  user: JiraUserIdentity | null,
): Promise<void> =>
  initSync({
    enabled: true,
    workspace: site.workspace,
    ...(user ? { user: { displayName: user.displayName } } : {}),
    storage: createMessagingStorageAdapter(),
    jira: createMessagingJiraPort(),
    syncRevealedState: true,
    onSyncError: (error) => {
      console.warn("[react-grab extension] sync error:", error.message);
    },
  });
