import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createRouter } from "./lib/create-router.js";
import { commentsRoutes } from "./routes/comments.js";
import { groupsRoutes } from "./routes/groups.js";
import { healthRoutes } from "./routes/health.js";

const app = createRouter();
app.route("/", healthRoutes);
app.route("/", commentsRoutes);
app.route("/", groupsRoutes);

app.doc("/doc", {
  openapi: "3.0.3",
  info: {
    title: "react-grab Sync API",
    version: "0.1.0",
    description: "API for the react-grab dashboard — comments, groups, workspaces.",
  },
  servers: [{ url: "http://localhost:3847", description: "Local" }],
});

// Fetch the spec from the app without starting a server
const response = await app.request("/doc");
const spec = await response.json();
const outPath = join(import.meta.dirname, "..", "openapi.json");
await writeFile(outPath, JSON.stringify(spec, null, 2), "utf-8");
console.log(`[sync-server] OpenAPI spec exported to ${outPath}`);
