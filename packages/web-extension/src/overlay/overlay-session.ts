import type { ReactGrabAPI, ToolbarState } from "react-grab";
import { LOCALHOST_PAGE_API_WAIT_MS } from "../constants.js";
import type { CaptureOptions } from "./capture-options.js";
import { createExtensionApi } from "./create-extension-api.js";
import { isLocalhostHost } from "./is-localhost-host.js";
import { isSameToolbarState } from "./is-same-toolbar-state.js";
import { wait } from "./wait.js";

interface OverlaySessionDeps {
  saveToolbarState: (toolbarState: ToolbarState) => void;
}

export interface OverlaySession {
  start: (
    toolbarState: ToolbarState | null,
    capture: CaptureOptions,
  ) => Promise<void>;
  stop: () => void;
  applyToolbarState: (toolbarState: ToolbarState) => void;
  adoptPageApi: (pageApi: ReactGrabAPI) => void;
  isStarted: () => boolean;
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

  const detach = (): void => {
    unsubscribeToolbarState?.();
    unsubscribeToolbarState = null;
    activeApi = null;
    lastSavedToolbarState = null;
  };

  const ownsApi = (): boolean =>
    activeApi !== null && activeApi === extensionApi;

  const findExistingApi = (): ReactGrabAPI | null =>
    activeApi ?? window.__REACT_GRAB__ ?? null;

  const resolveApi = async (
    capture: CaptureOptions,
  ): Promise<ReactGrabAPI | null> => {
    const existingApi = findExistingApi();
    if (existingApi) return attach(existingApi);

    if (isLocalhostHost(window.location.hostname)) {
      // HACK: a localhost app may load its own react-grab after this script; give it time to announce itself before reusing it
      await wait(LOCALHOST_PAGE_API_WAIT_MS);
      const pageApi = findExistingApi();
      return pageApi ? attach(pageApi) : null;
    }

    extensionApi = createExtensionApi(capture);
    return attach(extensionApi);
  };

  const applyWithoutEcho = (
    api: ReactGrabAPI,
    toolbarState: ToolbarState,
  ): void => {
    isApplyingExternalState = true;
    try {
      api.setToolbarState(toolbarState);
    } finally {
      isApplyingExternalState = false;
    }
  };

  return {
    start: async (toolbarState, capture) => {
      const api = await resolveApi(capture);
      if (api && toolbarState) applyWithoutEcho(api, toolbarState);
    },
    stop: () => {
      const ownedApi = extensionApi;
      if (!ownedApi || !ownsApi()) return;
      detach();
      extensionApi = null;
      if (window.__REACT_GRAB__ === ownedApi) delete window.__REACT_GRAB__;
      ownedApi.dispose();
    },
    applyToolbarState: (toolbarState) => {
      if (activeApi) applyWithoutEcho(activeApi, toolbarState);
    },
    adoptPageApi: (pageApi) => {
      if (activeApi && activeApi !== pageApi) activeApi.dispose();
      window.__REACT_GRAB__ = pageApi;
      attach(pageApi);
    },
    isStarted: () => activeApi !== null,
    ownsApi,
  };
};
