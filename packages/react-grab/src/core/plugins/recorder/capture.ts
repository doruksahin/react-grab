// packages/react-grab/src/core/plugins/recorder/capture.ts
import type { ReactGrabAPI } from "../../../types.js";
import type { CapturedStep } from "./types.js";
import { buildClickStep, buildChangeStep } from "./build-step.js";
import {
  createComponentInfoResolver,
  type ResolveComponentInfo,
} from "./component-info.js";
import { toRecorderUserFlow } from "./serialize.js";
import { toHumanText } from "./format-text.js";
import { writeRecordingToClipboard } from "./clipboard.js";

export interface RecorderController {
  start(): void;
  stop(): void;
  toggle(): void;
  isCapturing(): boolean;
  clear(): void;
  copyJson(): Promise<void>;
  copyText(): Promise<void>;
}

export const createCaptureController = (
  api: Pick<ReactGrabAPI, "getSource">,
): RecorderController => {
  const buffer: CapturedStep[] = [];
  const resolver: ResolveComponentInfo = createComponentInfoResolver(api);
  let attached = false;

  const onPointerDown = (event: Event): void => {
    if (!(event instanceof PointerEvent)) return;
    const step = buildClickStep(event);
    if (step) buffer.push(step);
  };

  const onChange = (event: Event): void => {
    const step = buildChangeStep(event);
    if (step) buffer.push(step);
  };

  return {
    start: () => {
      if (attached || typeof document === "undefined") return;
      document.addEventListener("pointerdown", onPointerDown, true);
      document.addEventListener("change", onChange, true);
      attached = true;
    },
    stop: () => {
      if (!attached || typeof document === "undefined") return;
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("change", onChange, true);
      attached = false;
    },
    toggle: function () {
      if (attached) this.stop();
      else this.start();
    },
    isCapturing: () => attached,
    clear: () => {
      buffer.length = 0;
    },
    copyJson: async () => {
      const flow = await toRecorderUserFlow(buffer.slice(), resolver);
      writeRecordingToClipboard(JSON.stringify(flow, null, 2));
    },
    copyText: async () => {
      const text = await toHumanText(buffer.slice(), resolver);
      writeRecordingToClipboard(text);
    },
  };
};
