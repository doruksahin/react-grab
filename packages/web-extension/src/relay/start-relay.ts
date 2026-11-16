import {
  extensionEventMessenger,
  extensionRequestMessenger,
} from "../messaging/extension-messengers.js";
import {
  OVERLAY_REQUEST_NAMES,
  type OverlayRequestProtocol,
} from "../messaging/overlay-request-protocol.js";
import {
  pageEventMessenger,
  pageRequestMessenger,
} from "../messaging/page-messengers.js";

const forwardRequest = <RequestName extends keyof OverlayRequestProtocol>(
  requestName: RequestName,
): void => {
  pageRequestMessenger.onMessage(requestName, ({ data }) =>
    extensionRequestMessenger.sendMessage(requestName, data),
  );
};

export const startRelay = (): void => {
  OVERLAY_REQUEST_NAMES.forEach(forwardRequest);

  extensionEventMessenger.onMessage("enabledChanged", ({ data }) => {
    void pageEventMessenger.sendMessage("enabledChanged", data);
  });

  extensionEventMessenger.onMessage("toolbarStateChanged", ({ data }) => {
    void pageEventMessenger.sendMessage("toolbarStateChanged", data);
  });
};
