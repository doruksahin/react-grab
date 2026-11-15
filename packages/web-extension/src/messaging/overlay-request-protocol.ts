import type { ToolbarState } from "react-grab";
import type { OverlayState } from "../types.js";

export interface OverlayRequestProtocol {
  getOverlayState(): OverlayState;
  saveToolbarState(toolbarState: ToolbarState): void;
}

export const OVERLAY_REQUEST_NAMES: ReadonlyArray<
  keyof OverlayRequestProtocol
> = ["getOverlayState", "saveToolbarState"];
