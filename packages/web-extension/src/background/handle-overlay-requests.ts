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
import { sitesItem } from "../settings/settings-items.js";
import {
  readOverlayState,
  toolbarStateItem,
} from "../storage/overlay-items.js";
import { toolbarStateSchema } from "../storage/toolbar-state-schema.js";

const handleOverlayStateRequests = (): void => {
  extensionRequestMessenger.onMessage("getOverlayState", ({ sender }) => {
    assertOwnExtensionSender(sender);
    return readOverlayState();
  });

  extensionRequestMessenger.onMessage(
    "saveToolbarState",
    async ({ data, sender }) => {
      assertOwnExtensionSender(sender);
      await toolbarStateItem.setValue(toolbarStateSchema.parse(data));
    },
  );

  extensionRequestMessenger.onMessage("getSiteSettings", async ({ sender }) => {
    assertTopFrameSender(sender);
    return findSenderSite(sender, await sitesItem.getValue());
  });
};

const handlePortRequests = (gateway: SyncGateway): void => {
  for (const method of portMethodNames<StorageAdapter>(STORAGE_METHODS)) {
    extensionRequestMessenger.onMessage(
      portRequestName("storage", method),
      ({ data, sender }) => gateway.callStorage(method, data, sender),
    );
  }
  for (const method of portMethodNames<JiraPort>(JIRA_METHODS)) {
    extensionRequestMessenger.onMessage(
      portRequestName("jira", method),
      ({ data, sender }) => gateway.callJira(method, data, sender),
    );
  }
};

export const handleOverlayRequests = (
  gateway: SyncGateway = createSyncGateway(),
): void => {
  handleOverlayStateRequests();
  handlePortRequests(gateway);
};
