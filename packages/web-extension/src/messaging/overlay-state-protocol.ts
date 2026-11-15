import type { ToolbarState } from "react-grab";
import type { OverlayState } from "../types.js";

export interface OverlayStateProtocol {
  getOverlayState(): OverlayState;
  saveToolbarState(toolbarState: ToolbarState): void;
  enabledChanged(enabled: boolean): void;
  toolbarStateChanged(toolbarState: ToolbarState): void;
}
