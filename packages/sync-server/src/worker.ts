import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { swaggerUI } from "@hono/swagger-ui";
import type { Bindings } from "./types.js";
import { createDb } from "./storage/d1-storage.js";
import type { Database } from "./storage/d1-storage.js";
import { commentsRoutes } from "./routes/comments.js";
import { groupsRoutes } from "./routes/groups.js";
import { healthRoutes } from "./routes/health.js";
import { screenshotsRoutes } from "./routes/screenshots.js";
import { DOC_CONFIG } from "./lib/doc-config.js";

const app = new OpenAPIHono<{ Bindings: Bindings; Variables: { db: Database } }>();

app.use("*", cors());
app.use("*", logger());

// Make db available in context via Hono variables
app.use("*", async (c, next) => {
  const db = createDb(c.env.DB);
  c.set("db", db);
  await next();
});

app.route("/", healthRoutes);
app.route("/", commentsRoutes);
app.route("/", groupsRoutes);
app.route("/", screenshotsRoutes);

app.doc("/doc", DOC_CONFIG);

app.get("/ui", swaggerUI({ url: "/doc" }));

export default app;
