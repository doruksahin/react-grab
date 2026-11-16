export interface SiteSettings {
  /** The sync workspace; its Jira destination is set on the server (ADR-0027). */
  workspace: string;
  /** Save the clicks and field changes that led to each comment (ADR-0025). */
  recordSteps: boolean;
  /** Record the session with rrweb and link it from each comment (ADR-0021). */
  recordSession: boolean;
}

export type SiteSettingsByOrigin = Record<string, SiteSettings>;

export interface SyncSettings {
  serverUrl: string | null;
  apiToken: string | null;
  /** Manages Jira accounts and destinations; read only by the service worker (ADR-0027). */
  adminToken: string | null;
  sites: SiteSettingsByOrigin;
}
