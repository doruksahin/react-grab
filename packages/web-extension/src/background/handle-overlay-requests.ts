import type { JiraPort, StorageAdapter } from "react-grab/sync-http";
import { extensionRequestMessenger } from "../messaging/extension-messengers.js";
import {
  JIRA_METHODS,
  STORAGE_METHODS,
  portMethodNames,
  portRequestName,
} from "../messaging/port-requests.js";
import {
  assertOwnExtensionSender,
  assertTopFrameSender,
  findSenderSite,
} from "../gateway/sender-policy.js";
import {
  type SyncGateway,
  createSyncGateway,
} from "../gateway/sync-gateway.js";
import {
  personalJiraAccountItem,
  sitesItem,
} from "../settings/settings-items.js";
import {
  readOverlayState,
  toolbarStateItem,
} from "../storage/overlay-items.js";
import { toolbarStateSchema } from "../storage/toolbar-state-schema.js";

const handleOverlayStateRequests = (ready: Promise<void>): void => {
  extensionRequestMessenger.onMessage("getOverlayState", async ({ sender }) => {
    await ready;
    assertOwnExtensionSender(sender);
    return readOverlayState();
  });

  extensionRequestMessenger.onMessage(
    "saveToolbarState",
    async ({ data, sender }) => {
      await ready;
      assertOwnExtensionSender(sender);
      await toolbarStateItem.setValue(toolbarStateSchema.parse(data));
    },
  );

  extensionRequestMessenger.onMessage("getJiraUser", async ({ sender }) => {
    await ready;
    assertTopFrameSender(sender);
    const personalJira = await personalJiraAccountItem.getValue();
    return personalJira
      ? {
          accountId: personalJira.accountId,
          displayName: personalJira.displayName,
        }
      : null;
  });

  extensionRequestMessenger.onMessage("getSiteSettings", async ({ sender }) => {
    await ready;
    assertTopFrameSender(sender);
    return findSenderSite(sender, await sitesItem.getValue());
  });
};

const handlePortRequests = (
  ready: Promise<void>,
  gateway: SyncGateway,
): void => {
  for (const method of portMethodNames<StorageAdapter>(STORAGE_METHODS)) {
    extensionRequestMessenger.onMessage(
      portRequestName("storage", method),
      async ({ data, sender }) => {
        await ready;
        return gateway.callStorage(method, data, sender);
      },
    );
  }
  for (const method of portMethodNames<JiraPort>(JIRA_METHODS)) {
    extensionRequestMessenger.onMessage(
      portRequestName("jira", method),
      async ({ data, sender }) => {
        await ready;
        return gateway.callJira(method, data, sender);
      },
    );
  }
};

export const handleOverlayRequests = (
  ready: Promise<void>,
  gateway: SyncGateway = createSyncGateway(),
): void => {
  handleOverlayStateRequests(ready);
  handlePortRequests(ready, gateway);
};
