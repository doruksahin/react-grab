import type { ToolbarState } from "react-grab";

export interface OverlayState {
  enabled: boolean;
  toolbarState: ToolbarState | null;
}
