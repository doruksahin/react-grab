import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { swaggerUI } from "@hono/swagger-ui";
import { createRouter } from "./lib/create-router.js";
import { commentsRoutes } from "./routes/comments.js";
import { groupsRoutes } from "./routes/groups.js";
import { healthRoutes } from "./routes/health.js";
import { screenshotsRoutes } from "./routes/screenshots.js";
import { DOC_CONFIG } from "./lib/doc-config.js";

interface CreateAppOptions {
  /** Middleware registered before routes (e.g. DI injection). */
  middleware?: MiddlewareHandler[];
}

export function createApp(options?: CreateAppOptions) {
  const app = createRouter();

  app.use("*", cors());
  app.use("*", logger());

  if (options?.middleware) {
    for (const mw of options.middleware) {
      app.use("*", mw);
    }
  }

  app.route("/", healthRoutes);
  app.route("/", commentsRoutes);
  app.route("/", groupsRoutes);
  app.route("/", screenshotsRoutes);

  app.doc("/doc", DOC_CONFIG);
  app.get("/ui", swaggerUI({ url: "/doc" }));

  return app;
}
