import { extensionEventMessenger } from "../messaging/extension-messengers.js";
import { forEachTab } from "./for-each-tab.js";

export const broadcastEnabled = (enabled: boolean): Promise<void> =>
  forEachTab((tabId) =>
    extensionEventMessenger.sendMessage("enabledChanged", enabled, tabId),
  );
