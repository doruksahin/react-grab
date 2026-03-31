import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { swaggerUI } from "@hono/swagger-ui";
import { serve } from "@hono/node-server";
import { commentsRoutes } from "./routes/comments.js";
import { groupsRoutes } from "./routes/groups.js";
import { healthRoutes } from "./routes/health.js";
import { createRouter } from "./lib/create-router.js";
import { DOC_CONFIG } from "./lib/doc-config.js";

const app = createRouter();

app.use("*", cors());
app.use("*", logger());
app.route("/", healthRoutes);
app.route("/", commentsRoutes);
app.route("/", groupsRoutes);

// OpenAPI spec endpoint — this is the single source of truth
app.doc("/doc", DOC_CONFIG);

// Swagger UI for browsing the spec
app.get("/ui", swaggerUI({ url: "/doc" }));

const PORT = parseInt(process.env.PORT ?? "3847", 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[sync-server] listening on http://localhost:${info.port}`);
  console.log(`[sync-server] Swagger UI: http://localhost:${info.port}/ui`);
  console.log(`[sync-server] OpenAPI spec: http://localhost:${info.port}/doc`);
});
