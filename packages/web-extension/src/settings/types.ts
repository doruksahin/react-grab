export interface SiteSettings {
  /** The sync workspace; its Jira destination is set on the server (ADR-0027). */
  workspace: string;
  /** Save the clicks and field changes that led to each comment (ADR-0025). */
  recordSteps: boolean;
  /** Record the session with rrweb and link it from each comment (ADR-0021). */
  recordSession: boolean;
}

export type SiteSettingsByOrigin = Record<string, SiteSettings>;

/** Who a personal Jira token signs in as (ADR-0031). Safe to show in a page. */
export interface JiraUserIdentity {
  accountId: string;
  displayName: string;
}

/** The user's own Jira credential and who it signs in as; read only by the service worker (ADR-0031). */
export interface PersonalJiraAccount extends JiraUserIdentity {
  email: string;
  apiToken: string;
}

export interface SyncSettings {
  serverUrl: string | null;
  apiToken: string | null;
  /** Manages Jira accounts and destinations; read only by the service worker (ADR-0027). */
  adminToken: string | null;
  sites: SiteSettingsByOrigin;
}
