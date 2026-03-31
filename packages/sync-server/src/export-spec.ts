import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createApp } from "./app.js";

// No middleware needed — we only introspect routes, never execute handlers
const app = createApp();

const response = await app.request("/doc");
if (!response.ok) {
  console.error(`[sync-server] /doc returned ${response.status}`);
  process.exit(1);
}
const spec = await response.json();
const outPath = join(import.meta.dirname, "..", "openapi.json");
await writeFile(outPath, JSON.stringify(spec, null, 2), "utf-8");
console.log(`[sync-server] OpenAPI spec exported to ${outPath}`);
