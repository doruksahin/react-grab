export interface SiteSettings {
  workspace: string;
  jiraProjectKey: string;
}

export type SiteSettingsByOrigin = Record<string, SiteSettings>;

export interface SyncSettings {
  serverUrl: string | null;
  apiToken: string | null;
  sites: SiteSettingsByOrigin;
}
