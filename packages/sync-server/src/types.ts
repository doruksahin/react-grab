/// <reference types="@cloudflare/workers-types" />

import type { SyncRepository, ScreenshotStore } from "./repositories/types.js";
import type { Database } from "./storage/d1-storage.js";

export type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  ENVIRONMENT: string;
};

export type Variables = {
  /** @deprecated use `repo` — will be removed after route migration */
  db: Database;
  repo: SyncRepository;
  screenshots: ScreenshotStore;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
