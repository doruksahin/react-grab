import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import type { Document } from "yaml";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScopeDef {
  description?: string;
  owning_feature?: string;
  owns?: string[];
}

export interface DataAttrsConfig {
  scan_roots?: string[];
  reserved?: string[];
  scopes?: Record<string, ScopeDef>;
  bare_verbs?: string[];
}

interface Occurrence {
  file: string;
  line: number;
}

export interface AttrInventoryEntry {
  scope: string;
  src: number;
  tests: number;
}

export interface DataAttrsScanResult {
  inventory: Record<string, AttrInventoryEntry>;
  occurrences: Record<string, Occurrence[]>;
  orphans: string[];
  unused: string[];
  staleTestAttrs: string[];
}

export interface LintIssue {
  kind: "orphan" | "unused" | "stale-test" | "bare-verb";
  attr: string;
  detail?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ATTR_REGEX_SOURCE = "data-react-grab-([a-z][a-z0-9-]*)";

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".turbo",
  "test-results",
  "playwright-report",
  "generated",
  ".next",
  ".wrangler",
]);

const SOURCE_FILE_REGEX = /\.(tsx?|jsx?|mjs|cjs)$/;

// ─── Helpers ────────────────────────────────────────────────────────────────

function* walk(dir: string): Generator<string> {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(join(dir, entry.name));
    } else if (entry.isFile() && SOURCE_FILE_REGEX.test(entry.name)) {
      yield join(dir, entry.name);
    }
  }
}

const isTestFile = (relPath: string): boolean =>
  relPath.includes("/e2e/") ||
  /\.(test|spec)\.(ts|tsx|mts|cts)$/.test(relPath) ||
  relPath.includes("/__tests__/");

const scanDirectory = (
  root: string,
  scanDir: string,
): Map<string, Occurrence[]> => {
  const attrs = new Map<string, Occurrence[]>();
  for (const file of walk(scanDir)) {
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");
    lines.forEach((line, idx) => {
      const re = new RegExp(ATTR_REGEX_SOURCE, "g");
      let match: RegExpExecArray | null;
      while ((match = re.exec(line)) !== null) {
        const suffix = match[1];
        if (!attrs.has(suffix)) attrs.set(suffix, []);
        attrs.get(suffix)!.push({
          file: relative(root, file),
          line: idx + 1,
        });
      }
    });
  }
  return attrs;
};

export const resolveScope = (
  suffix: string,
  config: DataAttrsConfig,
): string | null => {
  if (config.reserved?.includes(suffix)) return "reserved";
  if (!config.scopes) return null;
  for (const [name, scope] of Object.entries(config.scopes)) {
    if (scope.owns?.includes(suffix)) return name;
  }
  return null;
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Scan the configured scan_roots for `data-react-grab-*` occurrences and
 * classify each attribute into a scope or mark it as an orphan.
 */
export const scanDataAttrs = (
  root: string,
  config: DataAttrsConfig,
): DataAttrsScanResult => {
  const allOccurrences = new Map<string, Occurrence[]>();
  const scanRoots = config.scan_roots ?? [];

  for (const scanDir of scanRoots) {
    const absDir = resolve(root, scanDir);
    const attrs = scanDirectory(root, absDir);
    for (const [suffix, occs] of attrs) {
      if (!allOccurrences.has(suffix)) allOccurrences.set(suffix, []);
      allOccurrences.get(suffix)!.push(...occs);
    }
  }

  const inventory: Record<string, AttrInventoryEntry> = {};
  const occurrences: Record<string, Occurrence[]> = {};
  const orphans: string[] = [];
  const staleTestAttrs: string[] = [];

  const sortedEntries = [...allOccurrences.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );

  for (const [suffix, occs] of sortedEntries) {
    const src = occs.filter((o) => !isTestFile(o.file)).length;
    const tests = occs.filter((o) => isTestFile(o.file)).length;
    const scope = resolveScope(suffix, config);

    if (scope === null) orphans.push(suffix);
    if (src === 0 && tests > 0) staleTestAttrs.push(suffix);

    inventory[suffix] = { scope: scope ?? "UNKNOWN", src, tests };
    occurrences[suffix] = occs;
  }

  const declared = new Set<string>();
  for (const scope of Object.values(config.scopes ?? {})) {
    for (const own of scope.owns ?? []) declared.add(own);
  }
  const unused = [...declared]
    .filter((d) => !allOccurrences.has(d))
    .sort((a, b) => a.localeCompare(b));

  return { inventory, occurrences, orphans, unused, staleTestAttrs };
};

/**
 * Replace the `data_attrs.inventory` node on the given YAML document with
 * a fresh one built from the scan result. Entries are emitted in flow style
 * (one attr per line) and grouped by scope for scannability.
 */
export const writeInventoryToDoc = (
  doc: Document,
  inventory: Record<string, AttrInventoryEntry>,
): void => {
  const sorted = Object.entries(inventory).sort(([aSuffix, aEntry], [bSuffix, bEntry]) => {
    if (aEntry.scope !== bEntry.scope) return aEntry.scope.localeCompare(bEntry.scope);
    return aSuffix.localeCompare(bSuffix);
  });

  const ordered: Record<string, AttrInventoryEntry> = {};
  for (const [key, value] of sorted) ordered[key] = value;

  const node = doc.createNode(ordered) as unknown as {
    items?: Array<{ value?: { flow?: boolean } }>;
  };

  // Flow-style the per-attr maps so each entry fits on one line.
  if (node.items) {
    for (const pair of node.items) {
      if (pair.value && typeof pair.value === "object") {
        pair.value.flow = true;
      }
    }
  }

  doc.setIn(["data_attrs", "inventory"], node);
};

/**
 * Derive lint issues from a scan result. Orphans + stale-test attrs are
 * errors; unused + bare-verb attrs are warnings.
 */
export const validateDataAttrs = (
  result: DataAttrsScanResult,
  config: DataAttrsConfig,
): { errors: LintIssue[]; warnings: LintIssue[] } => {
  const errors: LintIssue[] = [];
  const warnings: LintIssue[] = [];

  for (const attr of result.orphans) {
    errors.push({
      kind: "orphan",
      attr,
      detail: "no scope in data_attrs.scopes owns this attr (add it or mark reserved)",
    });
  }

  for (const attr of result.staleTestAttrs) {
    errors.push({
      kind: "stale-test",
      attr,
      detail: "appears in tests but nowhere in src/ (stale selector?)",
    });
  }

  for (const attr of result.unused) {
    warnings.push({
      kind: "unused",
      attr,
      detail: "declared in data_attrs.scopes[*].owns but not found in code",
    });
  }

  const bareVerbs = config.bare_verbs ?? [];
  for (const attr of bareVerbs) {
    if (result.inventory[attr]) {
      warnings.push({
        kind: "bare-verb",
        attr,
        detail: "single-word attr; should be scoped per R2 (see data-attrs.md)",
      });
    }
  }

  return { errors, warnings };
};
