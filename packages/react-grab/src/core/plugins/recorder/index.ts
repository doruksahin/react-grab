// packages/react-grab/src/core/plugins/recorder/index.ts
import type { Plugin, ContextMenuAction } from "../../../types.js";
import { createCaptureController, type RecorderController } from "./capture.js";

let activeController: RecorderController | null = null;

const NOT_REGISTERED = (): Error =>
  new Error("Recorder plugin is not registered");

export const controls = {
  start: () => activeController?.start(),
  stop: () => activeController?.stop(),
  toggle: () => activeController?.toggle(),
  copyJson: (): Promise<void> =>
    activeController?.copyJson() ?? Promise.reject(NOT_REGISTERED()),
  copyText: (): Promise<void> =>
    activeController?.copyText() ?? Promise.reject(NOT_REGISTERED()),
  clear: () => activeController?.clear(),
  isCapturing: (): boolean => activeController?.isCapturing() ?? false,
};

const infoAction: ContextMenuAction = {
  id: "recorder.info",
  label: "Recorder — see docs",
  showInToolbarMenu: true,
  onAction: () => {
    // Discovery breadcrumb only — opens docs in real impl, no-op in tests.
    if (typeof window !== "undefined") {
      window.open("https://react-grab.com/docs/recorder", "_blank");
    }
  },
};

export const recorderPlugin: Plugin = {
  name: "recorder",
  setup: (api) => {
    activeController = createCaptureController(api);
    return {
      actions: [infoAction],
      cleanup: () => {
        activeController?.stop();
        activeController = null;
      },
    };
  },
};

// Co-export the controls so consumers can do:
//   import { recorderPlugin } from "react-grab"
//   recorderPlugin.controls.toggle()
// without a separate import.
(recorderPlugin as unknown as { controls: typeof controls }).controls = controls;
