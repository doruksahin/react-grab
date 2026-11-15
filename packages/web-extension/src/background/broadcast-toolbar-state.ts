import type { ToolbarState } from "react-grab";
import { extensionMessenger } from "../messaging/extension-messenger.js";
import { forEachTab } from "./for-each-tab.js";

export const broadcastToolbarState = (
  toolbarState: ToolbarState,
  sourceTabId?: number,
): Promise<void> =>
  forEachTab(
    (tabId) =>
      extensionMessenger.sendMessage(
        "toolbarStateChanged",
        toolbarState,
        tabId,
      ),
    sourceTabId,
  );
