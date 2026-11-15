import { assertExtensionPageSender } from "../gateway/sender-policy.js";
import { settingsMessenger } from "../messaging/extension-messengers.js";
import { removeSites, saveSite } from "../settings/settings-items.js";
import { settingsWriteQueue } from "./queues.js";

export const handleSettingsRequests = (ready: Promise<void>): void => {
  settingsMessenger.onMessage("saveSite", async ({ data, sender }) => {
    await ready;
    assertExtensionPageSender(sender);
    await settingsWriteQueue.run(() => saveSite(data.origin, data.site));
  });

  settingsMessenger.onMessage("removeSites", async ({ data, sender }) => {
    await ready;
    assertExtensionPageSender(sender);
    await settingsWriteQueue.run(() => removeSites(data));
  });
};
