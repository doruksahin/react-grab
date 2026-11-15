import { browser } from "wxt/browser";
import {
  OVERLAY_SCRIPT_FILE,
  OVERLAY_SCRIPT_ID,
  RELAY_SCRIPT_FILE,
  RELAY_SCRIPT_ID,
} from "../constants.js";
import { originMatchPattern } from "../settings/origin-match-pattern.js";
import type { SiteSettingsByOrigin } from "../settings/types.js";

const SITE_SCRIPT_IDS = [OVERLAY_SCRIPT_ID, RELAY_SCRIPT_ID];

const grantedMatchPatterns = async (
  sites: SiteSettingsByOrigin,
): Promise<string[]> => {
  const matchPatterns = Object.keys(sites).map(originMatchPattern);
  const grants = await Promise.all(
    matchPatterns.map((matchPattern) =>
      browser.permissions.contains({ origins: [matchPattern] }),
    ),
  );
  return matchPatterns.filter((_matchPattern, index) => grants[index]);
};

const replaceSiteScripts = async (sites: SiteSettingsByOrigin) => {
  const registeredScripts = await browser.scripting.getRegisteredContentScripts(
    { ids: SITE_SCRIPT_IDS },
  );
  if (registeredScripts.length > 0) {
    await browser.scripting.unregisterContentScripts({
      ids: registeredScripts.map((script) => script.id),
    });
  }

  const matches = await grantedMatchPatterns(sites);
  if (matches.length === 0) return;

  await browser.scripting.registerContentScripts([
    {
      id: RELAY_SCRIPT_ID,
      js: [RELAY_SCRIPT_FILE],
      matches,
      runAt: "document_start",
      allFrames: false,
      world: "ISOLATED",
    },
    {
      id: OVERLAY_SCRIPT_ID,
      js: [OVERLAY_SCRIPT_FILE],
      matches,
      runAt: "document_start",
      allFrames: false,
      world: "MAIN",
    },
  ]);
};

let pendingSync: Promise<void> = Promise.resolve();

export const syncSiteScripts = (sites: SiteSettingsByOrigin): Promise<void> => {
  pendingSync = pendingSync
    .catch(() => undefined)
    .then(() => replaceSiteScripts(sites));
  return pendingSync;
};
