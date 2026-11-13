import { createMiddleware } from "hono/factory";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema.js";
import { D1SyncRepository } from "../repositories/d1.repo.js";
import { R2ScreenshotStore } from "../repositories/r2.store.js";
import { JiraService } from "../services/jira.service.js";
import { parseJiraEnv } from "../schemas/env.js";
import type { AppEnv } from "../types.js";

export const injectRepos = createMiddleware<AppEnv>(async (c, next) => {
  const db = drizzle(c.env.DB, { schema });
  c.set("repo", new D1SyncRepository(db));
  c.set("screenshots", new R2ScreenshotStore(c.env.BUCKET));

  // Composition root for Jira: the only place the Jira configuration is read,
  // so it is also the only place it is validated.
  const jiraEnv = parseJiraEnv(c.env);
  c.set(
    "jira",
    new JiraService({
      baseUrl: jiraEnv.JIRA_BASE_URL,
      email: jiraEnv.JIRA_EMAIL,
      apiToken: jiraEnv.JIRA_API_TOKEN,
    }),
  );
  await next();
});
