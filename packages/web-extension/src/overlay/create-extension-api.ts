import type { Options, ReactGrabAPI } from "react-grab";
import { init } from "react-grab/core";
import { elementsToMarkdown } from "./elements-to-markdown.js";
import { isLocalhostHost } from "./is-localhost-host.js";

export const createExtensionApi = (): ReactGrabAPI => {
  const options: Options = { enabled: true };
  if (!isLocalhostHost(window.location.hostname)) {
    options.getContent = elementsToMarkdown;
  }
  const api = init(options);
  window.__REACT_GRAB__ = api;
  return api;
};
