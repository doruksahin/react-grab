import { extensionMessenger } from "../messaging/extension-messenger.js";
import { forEachTab } from "./for-each-tab.js";
import { showEnabledState } from "./show-enabled-state.js";

export const broadcastEnabled = (enabled: boolean): Promise<void> =>
  forEachTab(async (tabId) => {
    await showEnabledState(tabId, enabled);
    await extensionMessenger.sendMessage("enabledChanged", enabled, tabId);
  });
