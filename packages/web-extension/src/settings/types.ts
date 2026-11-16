export interface SiteSettings {
  workspace: string;
  jiraProjectKey: string;
  /** Save the clicks and field changes that led to each comment (ADR-0025). */
  recordSteps: boolean;
  /** Record the session with rrweb and link it from each comment (ADR-0021). */
  recordSession: boolean;
}

export type SiteSettingsByOrigin = Record<string, SiteSettings>;

export interface SyncSettings {
  serverUrl: string | null;
  apiToken: string | null;
  sites: SiteSettingsByOrigin;
}
