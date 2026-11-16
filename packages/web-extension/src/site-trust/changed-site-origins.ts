import {
  type StoredSiteSettings,
  withRecordingDefaults,
} from "../settings/migrate-sites.js";
import { siteSettingsSchema } from "../settings/settings-schema.js";
import type { SiteSettings, SiteSettingsByOrigin } from "../settings/types.js";

// Every setting is read when the overlay starts, so any change reloads the tab.
const SITE_SETTING_KEYS = siteSettingsSchema.keyof().options;

// The previous value may predate a setting (the storage migration itself
// writes one); it is compared with that setting's default, so an upgrade
// reloads nothing.
const isSameSite = (
  previous: StoredSiteSettings,
  next: SiteSettings,
): boolean => {
  const before = withRecordingDefaults(previous);
  return SITE_SETTING_KEYS.every((key) => before[key] === next[key]);
};

export interface ChangedSiteOrigins {
  removed: string[];
  reconfigured: string[];
}

export const changedSiteOrigins = (
  previousSites: Record<string, StoredSiteSettings>,
  nextSites: SiteSettingsByOrigin,
): ChangedSiteOrigins => {
  const removed: string[] = [];
  const reconfigured: string[] = [];
  for (const [origin, previousSite] of Object.entries(previousSites)) {
    const nextSite = nextSites[origin];
    if (!nextSite) {
      removed.push(origin);
    } else if (!isSameSite(previousSite, nextSite)) {
      reconfigured.push(origin);
    }
  }
  return { removed, reconfigured };
};
