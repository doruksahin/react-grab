import type { ReactGrabAPI, ToolbarState } from "react-grab";
import { LOCALHOST_PAGE_API_WAIT_MS } from "../constants.js";
import type { OverlayState } from "../types.js";
import { createExtensionApi } from "./create-extension-api.js";
import { isLocalhostHost } from "./is-localhost-host.js";
import { isSameToolbarState } from "./is-same-toolbar-state.js";
import { wait } from "./wait.js";

interface OverlaySessionDeps {
  saveToolbarState: (toolbarState: ToolbarState) => void;
}

export interface OverlaySession {
  start: (overlayState: OverlayState) => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  applyToolbarState: (toolbarState: ToolbarState) => Promise<void>;
  adoptPageApi: (pageApi: ReactGrabAPI) => void;
  ownsApi: () => boolean;
}

export const createOverlaySession = (
  deps: OverlaySessionDeps,
): OverlaySession => {
  let activeApi: ReactGrabAPI | null = null;
  let extensionApi: ReactGrabAPI | null = null;
  let lastSavedToolbarState: ToolbarState | null = null;
  let isApplyingExternalState = false;
  let unsubscribeToolbarState: (() => void) | null = null;

  const saveToolbarStateFromApi = (toolbarState: ToolbarState): void => {
    if (isApplyingExternalState) return;
    if (
      lastSavedToolbarState &&
      isSameToolbarState(lastSavedToolbarState, toolbarState)
    ) {
      return;
    }
    lastSavedToolbarState = toolbarState;
    deps.saveToolbarState(toolbarState);
  };

  const attach = (api: ReactGrabAPI): ReactGrabAPI => {
    if (api === activeApi) return api;
    unsubscribeToolbarState?.();
    activeApi = api;
    unsubscribeToolbarState = api.onToolbarStateChange(saveToolbarStateFromApi);
    return api;
  };

  const findExistingApi = (): ReactGrabAPI | null =>
    activeApi ?? window.__REACT_GRAB__ ?? null;

  const resolveApi = async (): Promise<ReactGrabAPI | null> => {
    const existingApi = findExistingApi();
    if (existingApi) return attach(existingApi);

    if (isLocalhostHost(window.location.hostname)) {
      // HACK: a localhost app may load its own react-grab after this script; give it time to announce itself before reusing it
      await wait(LOCALHOST_PAGE_API_WAIT_MS);
      const pageApi = findExistingApi();
      return pageApi ? attach(pageApi) : null;
    }

    extensionApi = createExtensionApi();
    return attach(extensionApi);
  };

  const applyWithoutEcho = (
    api: ReactGrabAPI,
    toolbarState: Partial<ToolbarState>,
  ): void => {
    isApplyingExternalState = true;
    try {
      api.setToolbarState(toolbarState);
    } finally {
      isApplyingExternalState = false;
    }
  };

  return {
    start: async (overlayState) => {
      const api = await resolveApi();
      if (!api) return;
      if (overlayState.toolbarState) {
        applyWithoutEcho(api, overlayState.toolbarState);
      }
      api.setEnabled(overlayState.enabled);
    },
    setEnabled: async (enabled) => {
      const api = await resolveApi();
      if (!api) return;
      applyWithoutEcho(api, { enabled });
      api.setEnabled(enabled);
    },
    applyToolbarState: async (toolbarState) => {
      const api = await resolveApi();
      if (api) applyWithoutEcho(api, toolbarState);
    },
    adoptPageApi: (pageApi) => {
      if (activeApi && activeApi !== pageApi) activeApi.dispose();
      window.__REACT_GRAB__ = pageApi;
      attach(pageApi);
    },
    ownsApi: () => activeApi !== null && activeApi === extensionApi,
  };
};
