import { browser } from "wxt/browser";
import { extensionMessenger } from "../messaging/extension-messenger.js";
import {
  enabledItem,
  readOverlayState,
  toolbarStateItem,
} from "../storage/overlay-items.js";
import { broadcastEnabled } from "./broadcast-enabled.js";
import { broadcastToolbarState } from "./broadcast-toolbar-state.js";
import { showEnabledState } from "./show-enabled-state.js";
import { toggleEnabled } from "./toggle-enabled.js";

export const registerBackground = (): void => {
  browser.action.onClicked.addListener(() => {
    void toggleEnabled();
  });

  enabledItem.watch((enabled) => {
    void broadcastEnabled(enabled);
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== "loading") return;
    void enabledItem
      .getValue()
      .then((enabled) => showEnabledState(tabId, enabled));
  });

  extensionMessenger.onMessage("getOverlayState", () => readOverlayState());

  extensionMessenger.onMessage("saveToolbarState", async ({ data, sender }) => {
    await toolbarStateItem.setValue(data);
    await broadcastToolbarState(data, sender.tab?.id);
  });
};
