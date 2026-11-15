import { browser } from "wxt/browser";
import { originMatchPattern } from "../settings/origin-match-pattern.js";

export const requestOriginPermission = async (
  origin: string,
): Promise<void> => {
  const granted = await browser.permissions.request({
    origins: [originMatchPattern(origin)],
  });
  if (!granted) throw new Error(`Access to ${origin} was not granted`);
};
