import {
  DEFAULT_ENABLED,
  OVERLAY_STATE_REQUEST_TIMEOUT_MS,
} from "../constants.js";
import { windowMessenger } from "../messaging/window-messenger.js";
import type { OverlayState } from "../types.js";
import { isReactGrabApi } from "./is-react-grab-api.js";
import { onDocumentReady } from "./on-document-ready.js";
import { createOverlaySession } from "./overlay-session.js";
import { wait } from "./wait.js";

const DEFAULT_OVERLAY_STATE: OverlayState = {
  enabled: DEFAULT_ENABLED,
  toolbarState: null,
};

const requestOverlayState = (): Promise<OverlayState> =>
  Promise.race([
    windowMessenger.sendMessage("getOverlayState"),
    wait(OVERLAY_STATE_REQUEST_TIMEOUT_MS).then(() => DEFAULT_OVERLAY_STATE),
  ]);

export const startOverlay = (): void => {
  const session = createOverlaySession({
    saveToolbarState: (toolbarState) => {
      void windowMessenger.sendMessage("saveToolbarState", toolbarState);
    },
  });

  windowMessenger.onMessage("enabledChanged", ({ data }) =>
    session.setEnabled(data),
  );
  windowMessenger.onMessage("toolbarStateChanged", ({ data }) =>
    session.applyToolbarState(data),
  );

  window.addEventListener("react-grab:init", (event) => {
    if (!(event instanceof CustomEvent)) return;
    const pageApi: unknown = event.detail;
    if (isReactGrabApi(pageApi)) session.adoptPageApi(pageApi);
  });

  onDocumentReady(() => {
    void requestOverlayState().then(session.start);
  });
};
