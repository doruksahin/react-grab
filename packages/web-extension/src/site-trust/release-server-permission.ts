import { browser } from "wxt/browser";
import { originMatchPattern } from "../settings/origin-match-pattern.js";
import { sitesItem } from "../settings/settings-items.js";

export const releaseServerPermission = async (
  previousServerUrl: string | null,
  nextServerUrl: string | null,
): Promise<void> => {
  if (!previousServerUrl) return;
  const previousOrigin = new URL(previousServerUrl).origin;
  if (nextServerUrl && new URL(nextServerUrl).origin === previousOrigin) return;
  const sites = await sitesItem.getValue();
  if (Object.hasOwn(sites, previousOrigin)) return;
  await browser.permissions.remove({
    origins: [originMatchPattern(previousOrigin)],
  });
};
