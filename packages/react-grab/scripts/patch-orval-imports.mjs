// Post-orval patch: orval v8.6.2 emits extensionless relative imports which
// tsc/tsup reject under nodenext moduleResolution. Append `.js` to known
// offenders in the single generated file.
import { readFileSync, writeFileSync } from "node:fs";

const file = "src/generated/sync-api.ts";
const src = readFileSync(file, "utf8");
const patched = src.replace(
  "from './custom-fetch'",
  "from './custom-fetch.js'",
);
if (patched !== src) writeFileSync(file, patched);
