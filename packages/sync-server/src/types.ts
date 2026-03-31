/// <reference types="@cloudflare/workers-types" />

import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "./db/schema.js";
import type { SyncRepository, ScreenshotStore } from "./repositories/types.js";

export type Database = DrizzleD1Database<typeof schema>;

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
