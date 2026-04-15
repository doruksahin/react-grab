import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "js-yaml";

const ROOT = resolve(import.meta.dirname, "..");
const ARCH_FILE = resolve(ROOT, "architecture.yml");

const PATH_PATTERN = /^packages\//;

const extractPaths = (value: unknown): string[] => {
  if (typeof value === "string" && PATH_PATTERN.test(value)) {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(extractPaths);
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap(extractPaths);
  }
  return [];
};

const yaml = load(readFileSync(ARCH_FILE, "utf8"));
const paths = [...new Set(extractPaths(yaml))].sort();

console.log("Checking architecture.yml paths...\n");

const stale: string[] = [];

for (const p of paths) {
  if (!existsSync(resolve(ROOT, p))) {
    stale.push(p);
  }
}

const valid = paths.length - stale.length;

if (stale.length > 0) {
  console.log(`STALE PATHS (${stale.length}):`);
  for (const p of stale) {
    console.log(`  ${p} → NOT FOUND`);
  }
  console.log();
}

console.log(`${valid}/${paths.length} paths valid`);

if (stale.length > 0) {
  console.log("\nERROR: Found stale paths in architecture.yml");
  process.exit(1);
} else {
  console.log("\nOK: All paths in architecture.yml exist on disk");
}
