/// <reference types="@cloudflare/workers-types" />

import type { SyncRepository, ScreenshotStore } from "./repositories/types.js";
import type { TicketLockService } from "./services/ticket-lock.service.js";
import type { JiraClientFactory } from "./services/jira-client-factory.js";
import type { JiraTicketService } from "./services/jira-ticket.service.js";
import type { JiraAccountService } from "./services/jira-account.service.js";
import type { WorkspaceService } from "./services/workspace.service.js";

export type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  ENVIRONMENT: string;
  // The environment Jira account (ADR-0018); only a fallback until the ADR-0027 cut-over.
  JIRA_BASE_URL?: string; // e.g. "https://acme.atlassian.net"
  JIRA_EMAIL?: string; // e.g. "bot@company.com"
  JIRA_API_TOKEN?: string; // API token (secret)
  JIRA_CREDENTIAL_KEYS?: string; // JSON key ring that encrypts Jira credentials (secret, ADR-0027)
  JIRA_CREDENTIAL_KEY_CURRENT?: string; // key version new writes use (ADR-0027)
  SYNC_API_TOKEN: string; // bearer token for every API request (secret, ADR-0020)
  SYNC_ADMIN_TOKEN?: string; // bearer token for Jira accounts and destinations (secret, ADR-0027)
  ALLOWED_ORIGINS?: string; // extra browser origins, comma-separated (ADR-0020)
};

export type Variables = {
  repo: SyncRepository;
  screenshots: ScreenshotStore;
  ticketLock: TicketLockService;
  jiraClients: JiraClientFactory;
  jiraTickets: JiraTicketService;
  jiraAccounts: JiraAccountService;
  workspaces: WorkspaceService;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
