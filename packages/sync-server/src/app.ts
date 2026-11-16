import type { MiddlewareHandler } from "hono";
import { logger } from "hono/logger";
import {
  corsForCallers,
  requireAdminToken,
  requireApiToken,
} from "./middleware/access-control.js";
import { HTTPException } from "hono/http-exception";
import { JiraError } from "./services/jira-errors.js";
import { swaggerUI } from "@hono/swagger-ui";
import { createRouter } from "./lib/create-router.js";
import { commentsRoutes } from "./routes/comments.js";
import { groupsRoutes } from "./routes/groups.js";
import { healthRoutes } from "./routes/health.js";
import { screenshotsRoutes } from "./routes/screenshots.js";
import { jiraRoutes } from "./routes/jira.js";
import { jiraAccountRoutes } from "./routes/jira-accounts.js";
import { workspaceRoutes } from "./routes/workspaces.js";
import {
  recordingShareRoutes,
  recordingUploadRoutes,
} from "./routes/recordings.js";
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
  // Jira accounts and workspace destinations need the admin token (ADR-0027).
  app.use("/jira-accounts/*", requireAdminToken);
  app.on(["PUT", "DELETE"], "/workspaces/:id/jira", requireAdminToken);

  // Only the data routes use the injected repos. Keeping the middleware off
  // /health means a missing Jira secret cannot take the health check down.
  for (const mw of options?.middleware ?? []) {
    app.use("/workspaces/*", mw);
    app.use("/jira/*", mw);
    app.use("/jira-accounts/*", mw);
    // Recording links: storage, but no token; the share id is the credential (ADR-0021).
    app.use("/r/*", mw);
  }

  app.route("/", healthRoutes);
  app.route("/", commentsRoutes);
  app.route("/", groupsRoutes);
  app.route("/", screenshotsRoutes);
  app.route("/", jiraRoutes);
  app.route("/", jiraAccountRoutes);
  app.route("/", workspaceRoutes);

  // A Jira or binding failure answers with its code, so the client can name it.
  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse();
    if (error instanceof JiraError) {
      return c.json({ error: error.message, code: error.code }, error.status);
    }
    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  });
  app.route("/", recordingUploadRoutes);
  app.route("/", recordingShareRoutes);

  app.doc("/doc", DOC_CONFIG);
  app.get("/ui", swaggerUI({ url: "/doc" }));

  return app;
}
