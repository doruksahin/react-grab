import type { ScreenshotKind } from "../sync/types.js";

/** An uploaded screenshot: the selection it belongs to and which of its two shots. */
export interface ScreenshotRef {
  selectionId: string;
  kind: ScreenshotKind;
}
