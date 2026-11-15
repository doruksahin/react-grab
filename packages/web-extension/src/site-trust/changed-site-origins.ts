import type { SiteSettingsByOrigin } from "../settings/types.js";

export interface ChangedSiteOrigins {
  removed: string[];
  reconfigured: string[];
}

export const changedSiteOrigins = (
  previousSites: SiteSettingsByOrigin,
  nextSites: SiteSettingsByOrigin,
): ChangedSiteOrigins => {
  const removed: string[] = [];
  const reconfigured: string[] = [];
  for (const [origin, previousSite] of Object.entries(previousSites)) {
    const nextSite = nextSites[origin];
    if (!nextSite) {
      removed.push(origin);
    } else if (
      nextSite.workspace !== previousSite.workspace ||
      nextSite.jiraProjectKey !== previousSite.jiraProjectKey
    ) {
      reconfigured.push(origin);
    }
  }
  return { removed, reconfigured };
};
