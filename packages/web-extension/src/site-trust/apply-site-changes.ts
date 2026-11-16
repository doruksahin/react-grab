import { browser } from "wxt/browser";
import { originMatchPattern } from "../settings/origin-match-pattern.js";
import { serverUrlItem } from "../settings/settings-items.js";
import type { SiteSettingsByOrigin } from "../settings/types.js";
import { changedSiteOrigins } from "./changed-site-origins.js";

const reloadOriginTabs = async (origins: string[]): Promise<void> => {
  if (origins.length === 0) return;
  const tabs = await browser.tabs.query({
    url: origins.map(originMatchPattern),
  });
  await Promise.allSettled(
    tabs.map((tab) =>
      tab.id === undefined ? Promise.resolve() : browser.tabs.reload(tab.id),
    ),
  );
};

const removeSitePermissions = async (origins: string[]): Promise<void> => {
  const serverUrl = await serverUrlItem.getValue();
  const serverOrigin = serverUrl ? new URL(serverUrl).origin : null;
  const removableOrigins = origins.filter((origin) => origin !== serverOrigin);
  if (removableOrigins.length === 0) return;
  await browser.permissions.remove({
    origins: removableOrigins.map(originMatchPattern),
  });
};

export const applySiteChanges = async (
  previousSites: SiteSettingsByOrigin,
  nextSites: SiteSettingsByOrigin,
): Promise<void> => {
  const { removed, reconfigured } = changedSiteOrigins(
    previousSites,
    nextSites,
  );
  await reloadOriginTabs([...removed, ...reconfigured]);
  await removeSitePermissions(removed);
};
