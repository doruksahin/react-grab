/// <reference types="@cloudflare/workers-types" />

import type { SyncRepository, ScreenshotStore } from "./repositories/types.js";
import type { JiraService } from "./services/jira.service.js";

export type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  ENVIRONMENT: string;
  JIRA_BASE_URL: string;      // e.g. "https://appier.atlassian.net"
  JIRA_EMAIL: string;         // e.g. "bot@company.com"
  JIRA_API_TOKEN: string;     // API token (secret)
};

export type Variables = {
  repo: SyncRepository;
  screenshots: ScreenshotStore;
  jira: JiraService;           // NEW
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
