import { type Browser, browser } from "wxt/browser";
import type { SiteSettings, SiteSettingsByOrigin } from "../settings/types.js";

const TOP_FRAME_ID = 0;

export class GatewayRefusalError extends Error {
  constructor(reason: string) {
    super(`React Grab extension refused the request: ${reason}`);
    this.name = "GatewayRefusalError";
  }
}

export const assertOwnExtensionSender = (
  sender: Browser.runtime.MessageSender,
): void => {
  if (sender.id !== browser.runtime.id) {
    throw new GatewayRefusalError("the sender is not this extension");
  }
};

export const assertTopFrameSender = (
  sender: Browser.runtime.MessageSender,
): void => {
  assertOwnExtensionSender(sender);
  if (sender.frameId !== TOP_FRAME_ID) {
    throw new GatewayRefusalError("the sender is not a top frame");
  }
};

export const findSenderSite = (
  sender: Browser.runtime.MessageSender,
  sites: SiteSettingsByOrigin,
): SiteSettings | null => {
  if (!sender.origin || !Object.hasOwn(sites, sender.origin)) return null;
  return sites[sender.origin] ?? null;
};
