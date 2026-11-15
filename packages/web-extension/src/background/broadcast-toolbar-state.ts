import type { ToolbarState } from "react-grab";
import { extensionEventMessenger } from "../messaging/extension-messengers.js";
import { enabledItem, withEnabledFlag } from "../storage/overlay-items.js";
import { forEachTab } from "./for-each-tab.js";

export const broadcastToolbarState = async (
  toolbarState: ToolbarState,
): Promise<void> => {
  const enabled = await enabledItem.getValue();
  await forEachTab((tabId) =>
    extensionEventMessenger.sendMessage(
      "toolbarStateChanged",
      withEnabledFlag(toolbarState, enabled),
      tabId,
    ),
  );
};
