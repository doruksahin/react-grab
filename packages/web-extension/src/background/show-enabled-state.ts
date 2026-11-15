import { browser } from "wxt/browser";
import {
  ACTION_BADGE_COLOR,
  ACTION_BADGE_TEXT_DISABLED,
  ACTION_TITLE_DISABLED,
  ACTION_TITLE_ENABLED,
} from "../constants.js";

export const showEnabledState = async (
  tabId: number,
  enabled: boolean,
): Promise<void> => {
  await browser.action.setTitle({
    tabId,
    title: enabled ? ACTION_TITLE_ENABLED : ACTION_TITLE_DISABLED,
  });
  await browser.action.setBadgeText({
    tabId,
    text: enabled ? "" : ACTION_BADGE_TEXT_DISABLED,
  });
  if (!enabled) {
    await browser.action.setBadgeBackgroundColor({
      tabId,
      color: ACTION_BADGE_COLOR,
    });
  }
};
