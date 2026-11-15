import { browser } from "wxt/browser";
import type { SyncGateway } from "../gateway/sync-gateway.js";
import { sitesItem } from "../settings/settings-items.js";
import { applySiteChanges } from "../site-trust/apply-site-changes.js";
import { removeRevokedSites } from "../site-trust/remove-revoked-sites.js";
import { syncSiteScripts } from "../site-trust/sync-site-scripts.js";
import { enabledItem, toolbarStateItem } from "../storage/overlay-items.js";
import { broadcastEnabled } from "./broadcast-enabled.js";
import { broadcastToolbarState } from "./broadcast-toolbar-state.js";
import { handleOverlayRequests } from "./handle-overlay-requests.js";
import { restrictStorageToExtension } from "./restrict-storage-to-extension.js";
import { showEnabledState } from "./show-enabled-state.js";
import { toggleEnabled } from "./toggle-enabled.js";

const reportBackgroundError = (error: unknown): void => {
  console.error("[react-grab extension]", error);
};

const restoreExtensionState = async (): Promise<void> => {
  await showEnabledState(await enabledItem.getValue());
  await syncSiteScripts(await sitesItem.getValue());
};

export const registerBackground = (gateway?: SyncGateway): void => {
  restrictStorageToExtension().catch(reportBackgroundError);

  browser.runtime.onInstalled.addListener(() => {
    restoreExtensionState().catch(reportBackgroundError);
  });
  browser.runtime.onStartup.addListener(() => {
    restoreExtensionState().catch(reportBackgroundError);
  });

  browser.action.onClicked.addListener(() => {
    toggleEnabled().catch(reportBackgroundError);
  });

  enabledItem.watch((enabled) => {
    showEnabledState(enabled).catch(reportBackgroundError);
    broadcastEnabled(enabled).catch(reportBackgroundError);
  });

  toolbarStateItem.watch((toolbarState) => {
    if (!toolbarState) return;
    broadcastToolbarState(toolbarState).catch(reportBackgroundError);
  });

  sitesItem.watch((nextSites, previousSites) => {
    syncSiteScripts(nextSites)
      .then(() => applySiteChanges(previousSites, nextSites))
      .catch(reportBackgroundError);
  });

  browser.permissions.onRemoved.addListener((revoked) => {
    removeRevokedSites(revoked).catch(reportBackgroundError);
  });

  handleOverlayRequests(gateway);
};
