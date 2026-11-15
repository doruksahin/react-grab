import { browser } from "wxt/browser";
import { enabledItem, toolbarStateItem } from "../storage/overlay-items.js";
import { broadcastEnabled } from "./broadcast-enabled.js";
import { broadcastToolbarState } from "./broadcast-toolbar-state.js";
import { handleOverlayRequests } from "./handle-overlay-requests.js";
import { showEnabledState } from "./show-enabled-state.js";
import { toggleEnabled } from "./toggle-enabled.js";

const showStoredEnabledState = async (): Promise<void> => {
  await showEnabledState(await enabledItem.getValue());
};

export const registerBackground = (): void => {
  browser.runtime.onInstalled.addListener(() => {
    void showStoredEnabledState();
  });
  browser.runtime.onStartup.addListener(() => {
    void showStoredEnabledState();
  });

  browser.action.onClicked.addListener(() => {
    void toggleEnabled();
  });

  enabledItem.watch((enabled) => {
    void showEnabledState(enabled);
    void broadcastEnabled(enabled);
  });

  toolbarStateItem.watch((toolbarState) => {
    if (toolbarState) void broadcastToolbarState(toolbarState);
  });

  handleOverlayRequests();
};
