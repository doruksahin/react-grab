import type { SiteSettings, SiteSettingsByOrigin } from "./types.js";

/**
 * A site as stored by any version: the recording settings may be missing,
 * and versions before 3 also kept a Jira project key.
 */
export type StoredSiteSettings = Pick<SiteSettings, "workspace"> &
  Partial<Pick<SiteSettings, "recordSteps" | "recordSession">> & {
    jiraProjectKey?: string;
  };

/**
 * A site as stored before step capture and session recording existed gets
 * both turned off, as a new site does (ADR-0025). Values already set are
 * kept. The Jira project key is dropped: the workspace's destination on the
 * server decides the project now (ADR-0027).
 */
export const withRecordingDefaults = ({
  jiraProjectKey: _jiraProjectKey,
  ...site
}: StoredSiteSettings): SiteSettings => ({
  ...site,
  recordSteps: site.recordSteps ?? false,
  recordSession: site.recordSession ?? false,
});

const migrateEverySite = (
  sites: Record<string, StoredSiteSettings>,
): SiteSettingsByOrigin =>
  Object.fromEntries(
    Object.entries(sites).map(([origin, site]) => [
      origin,
      withRecordingDefaults(site),
    ]),
  );

/** Storage version 2: every stored site gets the recording settings. */
export const addRecordingSettings = migrateEverySite;

/** Storage version 3: sites lose their Jira project key (ADR-0027). */
export const dropJiraProjectKey = migrateEverySite;
