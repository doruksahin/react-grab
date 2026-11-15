import { extensionMessenger } from "../messaging/extension-messenger.js";
import { windowMessenger } from "../messaging/window-messenger.js";

export const startRelay = (): void => {
  windowMessenger.onMessage("getOverlayState", () =>
    extensionMessenger.sendMessage("getOverlayState"),
  );

  windowMessenger.onMessage("saveToolbarState", ({ data }) =>
    extensionMessenger.sendMessage("saveToolbarState", data),
  );

  extensionMessenger.onMessage("enabledChanged", ({ data }) => {
    void windowMessenger.sendMessage("enabledChanged", data);
  });

  extensionMessenger.onMessage("toolbarStateChanged", ({ data }) => {
    void windowMessenger.sendMessage("toolbarStateChanged", data);
  });
};
