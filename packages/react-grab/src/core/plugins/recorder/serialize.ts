// packages/react-grab/src/core/plugins/recorder/serialize.ts
import type { CapturedStep, RecorderStep, RecorderUserFlow } from "./types.js";
import type { ResolveComponentInfo } from "./component-info.js";

const buildHeader = (): RecorderStep[] => [
  {
    type: "setViewport",
    width: window.innerWidth,
    height: window.innerHeight,
    deviceScaleFactor: window.devicePixelRatio ?? 1,
    isMobile: false,
    hasTouch: "ontouchstart" in window,
    isLandscape: window.innerWidth >= window.innerHeight,
  },
  { type: "navigate", url: window.location.href },
];

const mapCaptured = async (
  step: CapturedStep,
  resolve: ResolveComponentInfo,
): Promise<RecorderStep> => {
  const meta = await resolve(step.element);
  const extras = {
    ...(meta.component ? { "react-grab.component": meta.component } : {}),
    ...(meta.file ? { "react-grab.file": meta.file } : {}),
  };

  if (step.kind.type === "click") {
    return {
      type: "click",
      selectors: [[step.selector]],
      offsetX: step.kind.offsetX,
      offsetY: step.kind.offsetY,
      ...extras,
    };
  }
  return {
    type: "change",
    selectors: [[step.selector]],
    value: step.kind.value,
    ...extras,
  };
};

export const toRecorderUserFlow = async (
  steps: CapturedStep[],
  resolve: ResolveComponentInfo,
): Promise<RecorderUserFlow> => {
  const mapped = await Promise.all(steps.map((s) => mapCaptured(s, resolve)));
  return {
    title: `react-grab recording ${new Date().toISOString()}`,
    steps: [...buildHeader(), ...mapped],
  };
};
