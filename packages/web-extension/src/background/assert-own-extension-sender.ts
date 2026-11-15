import { browser, type Browser } from "wxt/browser";

export const assertOwnExtensionSender = (
  sender: Browser.runtime.MessageSender,
): void => {
  if (sender.id !== browser.runtime.id) {
    throw new Error("Rejected a request from outside this extension");
  }
};
