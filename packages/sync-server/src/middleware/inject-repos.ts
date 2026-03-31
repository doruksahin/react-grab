import { createMiddleware } from "hono/factory";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema.js";
import { D1SyncRepository } from "../repositories/d1.repo.js";
import { R2ScreenshotStore } from "../repositories/r2.store.js";
import type { AppEnv } from "../types.js";

export const injectRepos = createMiddleware<AppEnv>(async (c, next) => {
  const db = drizzle(c.env.DB, { schema });
  c.set("db", db); // deprecated — kept for backward compat until route migration
  c.set("repo", new D1SyncRepository(db));
  c.set("screenshots", new R2ScreenshotStore(c.env.BUCKET));
  await next();
});
