import { defineExtensionMessaging } from "@webext-core/messaging";
import type { OverlayEventProtocol } from "./overlay-event-protocol.js";
import type { OverlayRequestProtocol } from "./overlay-request-protocol.js";
import type { SettingsProtocol } from "./settings-protocol.js";

export const extensionRequestMessenger =
  defineExtensionMessaging<OverlayRequestProtocol>();

export const extensionEventMessenger =
  defineExtensionMessaging<OverlayEventProtocol>();

export const settingsMessenger = defineExtensionMessaging<SettingsProtocol>();
