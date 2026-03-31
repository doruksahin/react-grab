import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createRouter } from "./lib/create-router.js";
import { commentsRoutes } from "./routes/comments.js";
import { groupsRoutes } from "./routes/groups.js";
import { healthRoutes } from "./routes/health.js";
import { DOC_CONFIG } from "./lib/doc-config.js";

const app = createRouter();
app.route("/", healthRoutes);
app.route("/", commentsRoutes);
app.route("/", groupsRoutes);

app.doc("/doc", DOC_CONFIG);

// Fetch the spec from the app without starting a server
const response = await app.request("/doc");
if (!response.ok) {
  console.error(`[sync-server] /doc returned ${response.status}`);
  process.exit(1);
}
const spec = await response.json();
const outPath = join(import.meta.dirname, "..", "openapi.json");
await writeFile(outPath, JSON.stringify(spec, null, 2), "utf-8");
console.log(`[sync-server] OpenAPI spec exported to ${outPath}`);
