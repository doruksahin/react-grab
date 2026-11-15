import { defineWindowMessaging } from "@webext-core/messaging/page";
import { WINDOW_MESSAGING_NAMESPACE } from "../constants.js";
import type { OverlayStateProtocol } from "./overlay-state-protocol.js";

export const windowMessenger = defineWindowMessaging<OverlayStateProtocol>({
  namespace: WINDOW_MESSAGING_NAMESPACE,
});
