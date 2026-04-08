// packages/react-grab/src/core/plugins/recorder/types.ts

export interface CapturedStep {
  /** Unique id for dedupe + debugging. crypto.randomUUID() */
  id: string;
  /** Milliseconds since epoch when the event fired */
  timestamp: number;
  /** Reference to the DOM element at capture time. May be detached at export time. */
  element: Element;
  /** CSS selector resolved via createElementSelector at capture time */
  selector: string;
  kind: CapturedStepKind;
}

export type CapturedStepKind =
  | { type: "click"; offsetX: number; offsetY: number }
  | { type: "change"; value: string };

/**
 * Subset of Chrome DevTools Recorder JSON v1.
 * Source: https://developer.chrome.com/docs/devtools/recorder/reference
 * Only fields we emit. Inlined per ADR-0010 — no external dep.
 */
export interface RecorderUserFlow {
  title: string;
  steps: RecorderStep[];
}

export type RecorderStep =
  | {
      type: "setViewport";
      width: number;
      height: number;
      deviceScaleFactor: number;
      isMobile: boolean;
      hasTouch: boolean;
      isLandscape: boolean;
    }
  | { type: "navigate"; url: string }
  | {
      type: "click";
      selectors: string[][];
      offsetX: number;
      offsetY: number;
      "react-grab.component"?: string;
      "react-grab.file"?: string;
    }
  | {
      type: "change";
      selectors: string[][];
      value: string;
      "react-grab.component"?: string;
      "react-grab.file"?: string;
    };
