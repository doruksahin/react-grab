import { extensionRequestMessenger } from "../messaging/extension-messengers.js";
import {
  readOverlayState,
  toolbarStateItem,
} from "../storage/overlay-items.js";
import { toolbarStateSchema } from "../storage/toolbar-state-schema.js";
import { assertOwnExtensionSender } from "./assert-own-extension-sender.js";

export const handleOverlayRequests = (): void => {
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
};
