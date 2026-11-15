import { browser } from "wxt/browser";
import {
  ACTION_BADGE_COLOR,
  ACTION_BADGE_TEXT_DISABLED,
  ACTION_TITLE_DISABLED,
  ACTION_TITLE_ENABLED,
} from "../constants.js";

export const showEnabledState = async (enabled: boolean): Promise<void> => {
  await browser.action.setTitle({
    title: enabled ? ACTION_TITLE_ENABLED : ACTION_TITLE_DISABLED,
  });
  await browser.action.setBadgeText({
    text: enabled ? "" : ACTION_BADGE_TEXT_DISABLED,
  });
  await browser.action.setBadgeBackgroundColor({ color: ACTION_BADGE_COLOR });
};
