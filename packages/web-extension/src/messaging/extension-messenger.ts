import { defineExtensionMessaging } from "@webext-core/messaging";
import type { OverlayStateProtocol } from "./overlay-state-protocol.js";

export const extensionMessenger =
  defineExtensionMessaging<OverlayStateProtocol>();
