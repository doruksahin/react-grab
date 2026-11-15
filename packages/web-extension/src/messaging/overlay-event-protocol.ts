import type { ToolbarState } from "react-grab";

export interface OverlayEventProtocol {
  enabledChanged(enabled: boolean): void;
  toolbarStateChanged(toolbarState: ToolbarState): void;
}
