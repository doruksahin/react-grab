import {
  pageEventMessenger,
  pageRequestMessenger,
} from "../messaging/page-messengers.js";
import { isReactGrabApi } from "./is-react-grab-api.js";
import { onDocumentReady } from "./on-document-ready.js";
import {
  type OverlaySession,
  createOverlaySession,
} from "./overlay-session.js";
import { startSync } from "./start-sync.js";

const startSession = async (session: OverlaySession): Promise<void> => {
  const [overlayState, site] = await Promise.all([
    pageRequestMessenger.sendMessage("getOverlayState"),
    pageRequestMessenger.sendMessage("getSiteSettings"),
  ]);
  await session.start(overlayState);
  if (site && session.ownsApi()) await startSync(site);
};

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
    startSession(session).catch((error: unknown) => {
      console.warn("[react-grab extension] overlay failed to start:", error);
    });
  });
};
