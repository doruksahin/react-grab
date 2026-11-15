import {
  pageEventMessenger,
  pageRequestMessenger,
} from "../messaging/page-messengers.js";
import { isReactGrabApi } from "./is-react-grab-api.js";
import { onDocumentReady } from "./on-document-ready.js";
import { createOverlaySession } from "./overlay-session.js";

export const startOverlay = (): void => {
  const session = createOverlaySession({
    saveToolbarState: (toolbarState) => {
      void pageRequestMessenger.sendMessage("saveToolbarState", toolbarState);
    },
  });

  pageEventMessenger.onMessage("enabledChanged", ({ data }) =>
    session.setEnabled(data),
  );
  pageEventMessenger.onMessage("toolbarStateChanged", ({ data }) =>
    session.applyToolbarState(data),
  );

  window.addEventListener("react-grab:init", (event) => {
    if (!(event instanceof CustomEvent)) return;
    const pageApi: unknown = event.detail;
    if (isReactGrabApi(pageApi)) session.adoptPageApi(pageApi);
  });

  onDocumentReady(() => {
    void pageRequestMessenger
      .sendMessage("getOverlayState")
      .then(session.start);
  });
};
