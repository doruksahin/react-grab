import { vi } from "vitest";
import type { Browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing/fake-browser";

export const SITE_ORIGIN = "https://app.example.test";

/** Delivers the next runtime messages as if `sender` had sent them. */
export const sendAs = (sender: Browser.runtime.MessageSender): void => {
  vi.spyOn(fakeBrowser.runtime, "sendMessage").mockImplementation(
    (message: unknown, sendResponse: unknown) => {
      void fakeBrowser.runtime.onMessage.trigger(
        message,
        sender,
        (response: unknown) => {
          if (typeof sendResponse === "function") sendResponse(response);
        },
      );
    },
  );
};

export const sendAsOwnContentScript = (): void =>
  sendAs({
    id: fakeBrowser.runtime.id,
    frameId: 0,
    origin: SITE_ORIGIN,
    url: `${SITE_ORIGIN}/page`,
  });

export const sendAsOptionsPage = (): void =>
  sendAs({
    id: fakeBrowser.runtime.id,
    url: fakeBrowser.runtime.getURL("/options.html"),
  });
