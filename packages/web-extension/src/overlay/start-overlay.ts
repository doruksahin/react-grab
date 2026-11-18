import {
  pageEventMessenger,
  pageRequestMessenger,
} from "../messaging/page-messengers.js";
import { createSerialQueue } from "../utils/serial-queue.js";
import { isReactGrabApi } from "./is-react-grab-api.js";
import { onDocumentReady } from "./on-document-ready.js";
import {
  type OverlaySession,
  createOverlaySession,
} from "./overlay-session.js";
import { captureOptions } from "./capture-options.js";
import { startSync } from "./start-sync.js";

const reconcileSession = async (session: OverlaySession): Promise<void> => {
  const [overlayState, site, jiraUser] = await Promise.all([
    pageRequestMessenger.sendMessage("getOverlayState"),
    pageRequestMessenger.sendMessage("getSiteSettings"),
    pageRequestMessenger.sendMessage("getJiraUser"),
  ]);
  if (!overlayState.enabled) {
    session.stop();
    return;
  }
  if (session.isStarted()) return;
  await session.start(overlayState.toolbarState, captureOptions(site));
  if (site && session.ownsApi()) await startSync(site, jiraUser);
};

export const startOverlay = (): void => {
  const session = createOverlaySession({
    saveToolbarState: (toolbarState) => {
      void pageRequestMessenger.sendMessage("saveToolbarState", toolbarState);
    },
  });
  const sessionQueue = createSerialQueue();

  const reconcile = (): void => {
    sessionQueue
      .run(() => reconcileSession(session))
      .catch((error: unknown) => {
        console.warn("[react-grab extension] overlay failed to update:", error);
      });
  };

  pageEventMessenger.onMessage("enabledChanged", () =>
    onDocumentReady(reconcile),
  );
  pageEventMessenger.onMessage("toolbarStateChanged", ({ data }) =>
    session.applyToolbarState(data),
  );

  window.addEventListener("react-grab:init", (event) => {
    if (!(event instanceof CustomEvent)) return;
    const pageApi: unknown = event.detail;
    if (isReactGrabApi(pageApi)) session.adoptPageApi(pageApi);
  });

  onDocumentReady(reconcile);
};
