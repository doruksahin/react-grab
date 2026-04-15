import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..");
const ARCH_FILE = "architecture.yml";
const VISUAL_DIR = "docs/architecture/features";

// ─── File tracking ──────────────────────────────────────────────────────────

const hashFile = (absPath: string): string | null => {
  if (!existsSync(absPath)) return null;
  const content = readFileSync(absPath);
  return createHash("md5").update(content).digest("hex");
};

const snapshotDir = (dir: string): Map<string, string | null> => {
  const snap = new Map<string, string | null>();
  const absDir = resolve(ROOT, dir);
  if (!existsSync(absDir)) return snap;
  for (const entry of readdirSync(absDir)) {
    const rel = `${dir}/${entry}`;
    snap.set(rel, hashFile(resolve(ROOT, rel)));
  }
  return snap;
};

const snapshot = (): Map<string, string | null> => {
  const snap = new Map<string, string | null>();
  snap.set(ARCH_FILE, hashFile(resolve(ROOT, ARCH_FILE)));
  for (const [k, v] of snapshotDir(VISUAL_DIR)) {
    snap.set(k, v);
  }
  return snap;
};

// ─── Run ────────────────────────────────────────────────────────────────────

const run = (cmd: string) => {
  execSync(cmd, { cwd: ROOT, stdio: "pipe" });
};

// ─── Main ───────────────────────────────────────────────────────────────────

const before = snapshot();

console.log("arch — running codegen + visual generation...\n");

run("pnpm arch:visual");

// Snapshot after
const afterSnap = new Map<string, string | null>();
afterSnap.set(ARCH_FILE, hashFile(resolve(ROOT, ARCH_FILE)));
const absVisualDir = resolve(ROOT, VISUAL_DIR);
if (existsSync(absVisualDir)) {
  for (const entry of readdirSync(absVisualDir)) {
    const rel = `${VISUAL_DIR}/${entry}`;
    afterSnap.set(rel, hashFile(resolve(ROOT, rel)));
  }
}

// ─── Diff ───────────────────────────────────────────────────────────────────

const created: string[] = [];
const updated: string[] = [];
const unchanged: string[] = [];

for (const [file, afterHash] of afterSnap) {
  const beforeHash = before.get(file) ?? null;
  if (beforeHash === null && afterHash !== null) {
    created.push(file);
  } else if (beforeHash !== afterHash) {
    updated.push(file);
  } else {
    unchanged.push(file);
  }
}

// ─── Log ────────────────────────────────────────────────────────────────────

const log = (label: string, files: string[], color: string) => {
  if (files.length === 0) return;
  console.log(`${color}${label} (${files.length})\x1b[0m`);
  for (const f of files.sort()) {
    console.log(`  ${f}`);
  }
  console.log();
};

console.log();
log("CREATED", created, "\x1b[32m");
log("UPDATED", updated, "\x1b[33m");
log("UNCHANGED", unchanged, "\x1b[90m");

const total = created.length + updated.length + unchanged.length;
console.log(
  `${total} files tracked — ` +
    `\x1b[32m${created.length} created\x1b[0m, ` +
    `\x1b[33m${updated.length} updated\x1b[0m, ` +
    `\x1b[90m${unchanged.length} unchanged\x1b[0m`,
);
