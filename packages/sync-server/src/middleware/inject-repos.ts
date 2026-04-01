import { createMiddleware } from "hono/factory";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema.js";
import { D1SyncRepository } from "../repositories/d1.repo.js";
import { R2ScreenshotStore } from "../repositories/r2.store.js";
import { JiraService } from "../services/jira.service.js";
import type { AppEnv } from "../types.js";

export const injectRepos = createMiddleware<AppEnv>(async (c, next) => {
  const db = drizzle(c.env.DB, { schema });
  c.set("repo", new D1SyncRepository(db));
  c.set("screenshots", new R2ScreenshotStore(c.env.BUCKET));
  c.set("jira", new JiraService({
    baseUrl: c.env.JIRA_BASE_URL,
    email: c.env.JIRA_EMAIL,
    apiToken: c.env.JIRA_API_TOKEN,
  }));
  await next();
});
