import type { ReactGrabAPI } from "react-grab";
import { init } from "react-grab/core";
import type { CaptureOptions } from "./capture-options.js";

export const createExtensionApi = (capture: CaptureOptions): ReactGrabAPI => {
  const api = init({ enabled: true, ...capture });
  window.__REACT_GRAB__ = api;
  return api;
};
