/// <reference types="@cloudflare/workers-types" />

import type { SyncRepository, ScreenshotStore } from "./repositories/types.js";

export type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  ENVIRONMENT: string;
};

export type Variables = {
  repo: SyncRepository;
  screenshots: ScreenshotStore;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
