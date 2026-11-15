import { browser } from "wxt/browser";
import type { SyncGateway } from "../gateway/sync-gateway.js";
import { serverUrlItem, sitesItem } from "../settings/settings-items.js";
import { applySiteChanges } from "../site-trust/apply-site-changes.js";
import { releaseServerPermission } from "../site-trust/release-server-permission.js";
import { removeRevokedSites } from "../site-trust/remove-revoked-sites.js";
import { replaceSiteScripts } from "../site-trust/replace-site-scripts.js";
import { enabledItem, toolbarStateItem } from "../storage/overlay-items.js";
import { broadcastEnabled } from "./broadcast-enabled.js";
import { broadcastToolbarState } from "./broadcast-toolbar-state.js";
import { handleOverlayRequests } from "./handle-overlay-requests.js";
import { handleSettingsRequests } from "./handle-settings-requests.js";
import { siteTrustQueue } from "./queues.js";
import { restrictStorageToExtension } from "./restrict-storage-to-extension.js";
import { showEnabledState } from "./show-enabled-state.js";
import { toggleEnabled } from "./toggle-enabled.js";

const reportBackgroundError = (error: unknown): void => {
  console.error("[react-grab extension]", error);
};

const restoreExtensionState = async (): Promise<void> => {
  await showEnabledState(await enabledItem.getValue());
  const sites = await sitesItem.getValue();
  await siteTrustQueue.run(() => replaceSiteScripts(sites));
};

/*
 * Listeners are registered synchronously, as an MV3 service worker must, so
 * the events that wake it are not lost. Request handlers wait for
 * `storageRestricted` before they answer.
 */
export const registerBackground = (gateway?: SyncGateway): void => {
  const storageRestricted = restrictStorageToExtension().catch(
    reportBackgroundError,
  );

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
    siteTrustQueue
      .run(async () => {
        await replaceSiteScripts(nextSites);
        await applySiteChanges(previousSites, nextSites);
      })
      .catch(reportBackgroundError);
  });

  serverUrlItem.watch((nextServerUrl, previousServerUrl) => {
    siteTrustQueue
      .run(() => releaseServerPermission(previousServerUrl, nextServerUrl))
      .catch(reportBackgroundError);
  });

  browser.permissions.onRemoved.addListener((revoked) => {
    removeRevokedSites(revoked).catch(reportBackgroundError);
  });

  handleOverlayRequests(storageRestricted, gateway);
  handleSettingsRequests(storageRestricted);
};
