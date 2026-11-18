import type { ToolbarState } from "react-grab";
import { extensionEventMessenger } from "../messaging/extension-messengers.js";
import { forEachTab } from "./for-each-tab.js";

export const broadcastToolbarState = (
  toolbarState: ToolbarState,
): Promise<void> =>
  forEachTab((tabId) =>
    extensionEventMessenger.sendMessage(
      "toolbarStateChanged",
      toolbarState,
      tabId,
    ),
  );
