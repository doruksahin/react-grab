import type { ToolbarState } from "react-grab";
import { storage } from "wxt/utils/storage";
import { DEFAULT_ENABLED } from "../constants.js";
import type { OverlayState } from "../types.js";

export const enabledItem = storage.defineItem<boolean>(
  "local:react_grab_enabled",
  { fallback: DEFAULT_ENABLED },
);

export const toolbarStateItem = storage.defineItem<ToolbarState>(
  "local:react_grab_toolbar_state",
);

export const withEnabledFlag = (
  toolbarState: ToolbarState,
  enabled: boolean,
): ToolbarState => ({ ...toolbarState, enabled });

export const readOverlayState = async (): Promise<OverlayState> => {
  const [enabled, toolbarState] = await Promise.all([
    enabledItem.getValue(),
    toolbarStateItem.getValue(),
  ]);
  return {
    enabled,
    toolbarState: toolbarState && withEnabledFlag(toolbarState, enabled),
  };
};
