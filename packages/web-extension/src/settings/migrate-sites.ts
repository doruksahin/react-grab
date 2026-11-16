import type { SiteSettings, SiteSettingsByOrigin } from "./types.js";

/** A site as stored by any version: the recording settings may be missing. */
export type StoredSiteSettings = Pick<SiteSettings, "workspace" | "jiraProjectKey"> &
  Partial<Pick<SiteSettings, "recordSteps" | "recordSession">>;

/**
 * A site as stored before step capture and session recording existed gets
 * both turned off, as a new site does (ADR-0025). Values already set are kept.
 */
export const withRecordingDefaults = (site: StoredSiteSettings): SiteSettings => ({
  ...site,
  recordSteps: site.recordSteps ?? false,
  recordSession: site.recordSession ?? false,
});

/** Storage version 2: every stored site gets the recording settings. */
export const addRecordingSettings = (
  sites: Record<string, StoredSiteSettings>,
): SiteSettingsByOrigin =>
  Object.fromEntries(
    Object.entries(sites).map(([origin, site]) => [
      origin,
      withRecordingDefaults(site),
    ]),
  );
