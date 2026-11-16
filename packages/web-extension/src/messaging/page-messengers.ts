import { defineCustomEventMessaging } from "@webext-core/messaging/page";
import { PAGE_EVENT_NAMESPACE, PAGE_REQUEST_NAMESPACE } from "../constants.js";
import type { OverlayEventProtocol } from "./overlay-event-protocol.js";
import type { OverlayRequestProtocol } from "./overlay-request-protocol.js";

export const pageRequestMessenger =
  defineCustomEventMessaging<OverlayRequestProtocol>({
    namespace: PAGE_REQUEST_NAMESPACE,
  });

export const pageEventMessenger =
  defineCustomEventMessaging<OverlayEventProtocol>({
    namespace: PAGE_EVENT_NAMESPACE,
  });
