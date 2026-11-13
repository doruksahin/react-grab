/// <reference types="@cloudflare/workers-types" />

import type { SyncRepository, ScreenshotStore } from "./repositories/types.js";
import type { JiraService } from "./services/jira.service.js";

export type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  ENVIRONMENT: string;
  JIRA_BASE_URL: string; // e.g. "https://acme.atlassian.net"
  JIRA_EMAIL: string; // e.g. "bot@company.com"
  JIRA_API_TOKEN: string; // API token (secret)
  SYNC_API_TOKEN: string; // bearer token for every API request (secret, ADR-0020)
  ALLOWED_ORIGINS?: string; // extra browser origins, comma-separated (ADR-0020)
};

export type Variables = {
  repo: SyncRepository;
  screenshots: ScreenshotStore;
  jira: JiraService; // NEW
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
