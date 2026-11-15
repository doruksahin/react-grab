import type { ReactGrabAPI } from "react-grab";

export const isReactGrabApi = (value: unknown): value is ReactGrabAPI =>
  typeof value === "object" &&
  value !== null &&
  "setEnabled" in value &&
  typeof value.setEnabled === "function" &&
  "onToolbarStateChange" in value &&
  typeof value.onToolbarStateChange === "function";
