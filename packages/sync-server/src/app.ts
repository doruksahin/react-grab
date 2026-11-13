import type { MiddlewareHandler } from "hono";
import { logger } from "hono/logger";
import {
  corsForCallers,
  requireApiToken,
} from "./middleware/access-control.js";
import { swaggerUI } from "@hono/swagger-ui";
import { createRouter } from "./lib/create-router.js";
import { commentsRoutes } from "./routes/comments.js";
import { groupsRoutes } from "./routes/groups.js";
import { healthRoutes } from "./routes/health.js";
import { screenshotsRoutes } from "./routes/screenshots.js";
import { jiraRoutes } from "./routes/jira.js";
import { DOC_CONFIG } from "./lib/doc-config.js";

interface CreateAppOptions {
  /** Middleware registered before routes (e.g. DI injection). */
  middleware?: MiddlewareHandler[];
}

export function createApp(options?: CreateAppOptions) {
  const app = createRouter();

  app.use("*", corsForCallers);
  app.use("*", logger());

  // Everything that reads or writes data needs the API token (ADR-0020).
  // /health, /doc and /ui stay public.
  app.use("/workspaces/*", requireApiToken);
  app.use("/jira/*", requireApiToken);

  // Only the data routes use the injected repos. Keeping the middleware off
  // /health means a missing Jira secret cannot take the health check down.
  for (const mw of options?.middleware ?? []) {
    app.use("/workspaces/*", mw);
    app.use("/jira/*", mw);
  }

  app.route("/", healthRoutes);
  app.route("/", commentsRoutes);
  app.route("/", groupsRoutes);
  app.route("/", screenshotsRoutes);
  app.route("/", jiraRoutes);

  app.doc("/doc", DOC_CONFIG);
  app.get("/ui", swaggerUI({ url: "/doc" }));

  return app;
}
