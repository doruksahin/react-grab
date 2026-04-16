import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
} from "node:fs";
import { resolve, relative, dirname, basename } from "node:path";
import { parseDocument } from "yaml";
import madge from "madge";
import { Project, SyntaxKind } from "ts-morph";
import {
  scanDataAttrs,
  writeInventoryToDoc,
  type DataAttrsConfig,
} from "./data-attrs.js";

const ROOT = resolve(import.meta.dirname, "..");
const ARCH_FILE = resolve(ROOT, "architecture.yml");
const FEATURES_DIR = "packages/react-grab/src/features";

// ─── Types ──────────────────────────────────────────────────────────────────

interface FeatureEntry {
  description?: string;
  status?: string;
  files?: string[];
  [key: string]: unknown;
}

interface SourceEntry {
  store_path?: string;
  trigger?: string;
  consumers?: string[];
  [key: string]: unknown;
}

interface DataFlowEntry {
  description?: string;
  composition_root?: string;
  store?: string;
  sources?: Record<string, SourceEntry>;
  [key: string]: unknown;
}

interface FeatureSummary {
  name: string;
  before: number;
  after: number;
}

interface FlowSummary {
  path: string;
  before: number;
  after: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const getPackagePrefix = (filePath: string): string | null => {
  const match = filePath.match(/^(packages\/[^/]+)\//);
  return match ? match[1] : null;
};

/**
 * Extract "owned directory" prefixes from a feature's file list.
 * Only features/ and components/ sub-directories become directory scopes.
 * Other files (core/index.tsx, utils/*) stay as exact file matches to
 * prevent scope creep across runs.
 */
const getOwnedPrefixes = (files: string[]): string[] => {
  const prefixes = new Set<string>();
  for (const f of files) {
    const parts = f.split("/");
    // packages/<pkg>/src/(features|components)/<name>/... → directory scope
    if (
      parts.length > 5 &&
      (parts[3] === "features" || parts[3] === "components")
    ) {
      prefixes.add(parts.slice(0, 5).join("/") + "/");
    } else {
      // Exact file match for anything outside features/components
      prefixes.add(f);
    }
  }
  return [...prefixes];
};

/**
 * Pick a stable entry point from the feature's own file list.
 * Prefers index.ts already in the list, then first sorted features/ file.
 * Never looks up files on disk — prevents scope creep from shared directories.
 */
const pickEntryPoint = (files: string[]): string => {
  // Prefer index.ts already listed in the feature's files
  const sorted = [...files].sort();
  const featureIndex = sorted.find((f) =>
    /\/features\/[^/]+\/index\.ts$/.test(f),
  );
  if (featureIndex) return featureIndex;

  // Fall back: first sorted features/ file, then first sorted file
  return sorted.find((f) => f.includes("/features/")) ?? sorted[0];
};

const isWithinScope = (file: string, prefixes: string[]): boolean => {
  for (const prefix of prefixes) {
    if (prefix.endsWith("/") && file.startsWith(prefix)) return true;
    if (file === prefix) return true;
  }
  return false;
};

const resolveMadgeTree = (
  tree: Record<string, string[]>,
  entryDir: string,
): string[] => {
  return Object.keys(tree)
    .map((f) => relative(ROOT, resolve(entryDir, f)))
    .filter((f) => f.startsWith("packages/"));
};

// ─── Pass 1: Madge — feature file discovery ─────────────────────────────────

interface MadgePassResult {
  updated: Record<string, string[]>;
  summary: FeatureSummary[];
  trees: Record<string, Record<string, string[]>>;
  entryDirs: Record<string, string>;
}

const runMadgePass = async (
  features: Record<string, FeatureEntry>,
): Promise<MadgePassResult> => {
  const updated: Record<string, string[]> = {};
  const summary: FeatureSummary[] = [];
  const trees: Record<string, Record<string, string[]>> = {};
  const entryDirs: Record<string, string> = {};

  for (const [name, feature] of Object.entries(features)) {
    if (!feature.files || feature.files.length === 0) {
      summary.push({ name, before: 0, after: 0 });
      continue;
    }

    const entryFile = pickEntryPoint(feature.files);
    const entryAbs = resolve(ROOT, entryFile);
    if (!existsSync(entryAbs)) {
      console.warn(`  WARN: entry ${entryFile} not found, skipping feature "${name}"`);
      summary.push({ name, before: feature.files.length, after: feature.files.length });
      continue;
    }

    const entryPackage = getPackagePrefix(entryFile);
    const entryDir = dirname(entryAbs);

    // Scope: only include files within directories this feature already claims
    const samePkgFiles = feature.files.filter((f) => getPackagePrefix(f) === entryPackage);
    const ownedPrefixes = getOwnedPrefixes(samePkgFiles);

    // Cross-package files preserved as-is
    const crossPackageFiles = feature.files.filter(
      (f) => getPackagePrefix(f) !== entryPackage && existsSync(resolve(ROOT, f)),
    );

    const tsConfigPath = entryPackage
      ? resolve(ROOT, entryPackage, "tsconfig.json")
      : undefined;

    try {
      const result = await madge(entryAbs, {
        fileExtensions: ["ts", "tsx"],
        tsConfig: tsConfigPath && existsSync(tsConfigPath) ? tsConfigPath : undefined,
      });
      const tree = result.obj();
      trees[name] = tree;
      entryDirs[name] = entryDir;

      const allDiscovered = resolveMadgeTree(tree, entryDir);

      // Filter to owned scope only
      const scoped = allDiscovered.filter((f) => isWithinScope(f, ownedPrefixes));

      // Also keep existing same-package files that still exist on disk
      // (madge may not reach component files from feature logic entry)
      const existingValid = samePkgFiles.filter((f) => existsSync(resolve(ROOT, f)));

      const merged = [...new Set([...scoped, ...existingValid, ...crossPackageFiles])].sort();
      updated[name] = merged;
      summary.push({ name, before: feature.files.length, after: merged.length });
    } catch (err) {
      console.warn(`  WARN: madge failed for "${name}": ${err}`);
      summary.push({ name, before: feature.files.length, after: feature.files.length });
    }
  }

  return { updated, summary, trees, entryDirs };
};

// ─── Pass 2: ts-morph — reactive chain detection ────────────────────────────

interface DetectedSource {
  storePath?: string;
  trigger?: string;
  consumers: string[];
}

const runTsMorphPass = async (
  dataFlows: Record<string, DataFlowEntry>,
): Promise<{ updated: Record<string, Record<string, DetectedSource>>; summary: FlowSummary[] }> => {
  const updated: Record<string, Record<string, DetectedSource>> = {};
  const summary: FlowSummary[] = [];

  for (const [flowName, flow] of Object.entries(dataFlows)) {
    if (!flow.composition_root) continue;

    const rootAbs = resolve(ROOT, flow.composition_root);
    if (!existsSync(rootAbs)) {
      console.warn(`  WARN: composition_root ${flow.composition_root} not found`);
      continue;
    }

    // ── AST analysis ──────────────────────────────────────────────────────
    const project = new Project({ compilerOptions: { allowJs: true } });
    const sourceFile = project.addSourceFileAtPath(rootAbs);
    const detectedSources: Record<string, DetectedSource> = {};
    const callExprs = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    // Initialize from existing sources
    if (flow.sources) {
      for (const [srcName, src] of Object.entries(flow.sources)) {
        detectedSources[srcName] = {
          storePath: src.store_path,
          consumers: [],
        };
      }
    }

    for (const call of callExprs) {
      const text = call.getExpression().getText();

      // createStore / createSyncStore — confirms store location
      if (text === "createStore" || text === "createSyncStore") {
        // Store confirmed at flow.store path — already set from existing sources
      }

      // setInterval(fn, interval) — detect poll trigger
      if (text === "setInterval") {
        const args = call.getArguments();
        if (args.length >= 2) {
          const fnName = args[0].getText();
          let intervalText = args[1].getText();

          // Resolve constant to human-readable duration
          if (args[1].getKind() === SyntaxKind.Identifier) {
            const varDecl = sourceFile.getVariableDeclaration(intervalText);
            if (varDecl) {
              const init = varDecl.getInitializer();
              if (init) {
                const ms = parseInt(init.getText().replace(/_/g, ""), 10);
                if (!isNaN(ms)) {
                  intervalText = ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`;
                }
              }
            }
          }

          const triggerDesc = `${fnName}() via ${intervalText} setInterval`;

          if (flow.sources) {
            for (const [srcName, src] of Object.entries(flow.sources)) {
              if (src.trigger || srcName.includes("jira") || srcName.includes("poll")) {
                detectedSources[srcName].trigger = triggerDesc;
              }
            }
          }
        }
      }
    }

    // ── Consumer tracing via madge ──────────────────────────────────────────
    const filesToTrace = [flow.composition_root];
    if (flow.store) filesToTrace.push(flow.store);

    const consumerSet = new Set<string>();

    for (const traceFile of filesToTrace) {
      const traceAbs = resolve(ROOT, traceFile);
      if (!existsSync(traceAbs)) continue;

      const pkg = getPackagePrefix(traceFile);
      const tsConfigPath = pkg
        ? resolve(ROOT, pkg, "tsconfig.json")
        : undefined;
      const pkgSrcDir = pkg ? resolve(ROOT, pkg, "src") : dirname(traceAbs);

      try {
        const result = await madge(pkgSrcDir, {
          fileExtensions: ["ts", "tsx"],
          tsConfig: tsConfigPath && existsSync(tsConfigPath) ? tsConfigPath : undefined,
        });
        const tree = result.obj();

        // Find files that directly depend on our target
        for (const [file, deps] of Object.entries(tree)) {
          for (const dep of deps) {
            const depAbs = resolve(pkgSrcDir, dep);
            if (depAbs === traceAbs) {
              const consumerRel = relative(ROOT, resolve(pkgSrcDir, file));
              if (consumerRel.startsWith("packages/")) {
                consumerSet.add(consumerRel);
              }
            }
          }
        }
      } catch {
        // madge may fail on large dirs — skip
      }
    }

    const consumerList = [...consumerSet].sort();

    // Assign consumers to all sources
    for (const srcName of Object.keys(detectedSources)) {
      detectedSources[srcName].consumers = consumerList;

      const existingSrc = flow.sources?.[srcName];
      const before = Array.isArray(existingSrc?.consumers) ? existingSrc.consumers.length : 0;
      summary.push({
        path: `${flowName}.sources.${srcName}`,
        before,
        after: consumerList.length,
      });
    }

    updated[flowName] = detectedSources;
  }

  return { updated, summary };
};

// ─── Pass 3: Detect new features on disk ────────────────────────────────────

const detectNewFeatures = (existingFeatures: Record<string, FeatureEntry>): string[] => {
  const featuresAbs = resolve(ROOT, FEATURES_DIR);
  if (!existsSync(featuresAbs)) return [];

  const dirsOnDisk = readdirSync(featuresAbs, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  // A directory is "covered" if any existing feature references a file within it
  const coveredDirs = new Set<string>();
  for (const feature of Object.values(existingFeatures)) {
    if (!feature.files) continue;
    for (const f of feature.files) {
      const match = f.match(/src\/features\/([^/]+)\//);
      if (match) coveredDirs.add(match[1]);
    }
  }

  return dirsOnDisk.filter((d) => !coveredDirs.has(d)).sort();
};

// ─── Pass 4: Merge into YAML document ───────────────────────────────────────

const mergeIntoDocument = (
  doc: ReturnType<typeof parseDocument>,
  madgeResults: Record<string, string[]>,
  tsMorphResults: Record<string, Record<string, DetectedSource>>,
  newFeatures: string[],
) => {
  // Replace feature file lists
  for (const [name, files] of Object.entries(madgeResults)) {
    doc.setIn(["features", name, "files"], doc.createNode(files));
  }

  // Replace data_flow source fields
  for (const [flowName, sources] of Object.entries(tsMorphResults)) {
    for (const [srcName, detected] of Object.entries(sources)) {
      if (detected.storePath) {
        doc.setIn(
          ["data_flows", flowName, "sources", srcName, "store_path"],
          detected.storePath,
        );
      }
      if (detected.trigger) {
        doc.setIn(
          ["data_flows", flowName, "sources", srcName, "trigger"],
          detected.trigger,
        );
      }
      if (detected.consumers.length > 0) {
        doc.setIn(
          ["data_flows", flowName, "sources", srcName, "consumers"],
          doc.createNode(detected.consumers),
        );
      }
    }
  }

  // Append new features
  for (const name of newFeatures) {
    const indexFile = `${FEATURES_DIR}/${name}/index.ts`;
    const hasIndex = existsSync(resolve(ROOT, indexFile));
    doc.setIn(
      ["features", name],
      doc.createNode({
        description: "TODO",
        status: "discovered",
        files: hasIndex ? [indexFile] : [],
      }),
    );
  }
};

// ─── Visual generation ──────────────────────────────────────────────────────

const VISUAL_DIR = resolve(ROOT, "docs/architecture/features");

const sanitizeMermaidId = (s: string): string =>
  s.replace(/[^a-zA-Z0-9_]/g, "_");

const shortenPath = (filePath: string): string => {
  // "../../generated/sync-api.ts" → "generated/sync-api.ts"
  // "derive-status.ts" → "derive-status.ts"
  // "../selection-groups/types.ts" → "selection-groups/types.ts"
  return filePath.replace(/^(\.\.\/)+/, "");
};

const groupByDirectory = (files: string[]): Record<string, string[]> => {
  const groups: Record<string, string[]> = {};
  for (const f of files) {
    const short = shortenPath(f);
    const parts = short.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
    if (!groups[dir]) groups[dir] = [];
    groups[dir].push(parts[parts.length - 1]);
  }
  return groups;
};

const generateMermaid = (
  featureName: string,
  tree: Record<string, string[]>,
  featureFiles: string[],
  entryDir: string,
): string => {
  // Resolve tree files to repo-relative and filter to feature scope
  const featureSet = new Set(featureFiles);
  const repoRelTree: Record<string, string[]> = {};

  for (const [file, deps] of Object.entries(tree)) {
    const fileRel = relative(ROOT, resolve(entryDir, file));
    if (!featureSet.has(fileRel)) continue;

    const resolvedDeps = deps
      .map((d) => relative(ROOT, resolve(entryDir, d)))
      .filter((d) => featureSet.has(d));

    repoRelTree[fileRel] = resolvedDeps;
  }

  const lines: string[] = [
    `%% ${featureName} — dependency graph`,
    `%% Generated by pnpm arch:codegen --visual`,
    "graph LR",
  ];

  // Group files into subgraphs by package/directory
  const allFiles = Object.keys(repoRelTree);
  const subgraphs: Record<string, string[]> = {};

  for (const f of allFiles) {
    // packages/react-grab/src/features/sidebar/derive-status.ts → features/sidebar
    const match = f.match(/packages\/([^/]+)\/src\/(.+)\/[^/]+$/);
    if (match) {
      const key = `${match[1]}/${match[2]}`;
      if (!subgraphs[key]) subgraphs[key] = [];
      subgraphs[key].push(f);
    } else {
      const pkg = f.match(/packages\/([^/]+)\//)?.[1] ?? "other";
      if (!subgraphs[pkg]) subgraphs[pkg] = [];
      subgraphs[pkg].push(f);
    }
  }

  // Emit subgraphs
  for (const [group, files] of Object.entries(subgraphs).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const groupId = sanitizeMermaidId(group);
    lines.push(`  subgraph ${groupId}["${group}"]`);
    for (const f of files.sort()) {
      const id = sanitizeMermaidId(f);
      const label = basename(f);
      lines.push(`    ${id}["${label}"]`);
    }
    lines.push("  end");
  }

  // Emit edges
  for (const [file, deps] of Object.entries(repoRelTree)) {
    const fromId = sanitizeMermaidId(file);
    for (const dep of deps.sort()) {
      const toId = sanitizeMermaidId(dep);
      lines.push(`  ${fromId} --> ${toId}`);
    }
  }

  return lines.join("\n") + "\n";
};

const generateSvgs = async (
  features: Record<string, FeatureEntry>,
): Promise<number> => {
  let count = 0;
  for (const [name, feature] of Object.entries(features)) {
    if (!feature.files || feature.files.length === 0) continue;

    const entryFile = pickEntryPoint(feature.files);
    const entryAbs = resolve(ROOT, entryFile);
    if (!existsSync(entryAbs)) continue;

    const entryPackage = getPackagePrefix(entryFile);
    const tsConfigPath = entryPackage
      ? resolve(ROOT, entryPackage, "tsconfig.json")
      : undefined;

    try {
      const result = await madge(entryAbs, {
        fileExtensions: ["ts", "tsx"],
        tsConfig:
          tsConfigPath && existsSync(tsConfigPath) ? tsConfigPath : undefined,
      });
      const svgPath = resolve(VISUAL_DIR, `${name}.svg`);
      await result.image(svgPath);
      count++;
    } catch {
      console.warn(`  WARN: SVG generation failed for "${name}"`);
    }
  }
  return count;
};

const generateVisuals = async (
  features: Record<string, FeatureEntry>,
  madgeTrees: Record<string, Record<string, string[]>>,
  madgeEntryDirs: Record<string, string>,
  madgeResults: Record<string, string[]>,
): Promise<void> => {
  mkdirSync(VISUAL_DIR, { recursive: true });

  // Mermaid diagrams
  let mermaidCount = 0;
  for (const [name, tree] of Object.entries(madgeTrees)) {
    const featureFiles = madgeResults[name];
    if (!featureFiles || featureFiles.length === 0) continue;

    const mmd = generateMermaid(name, tree, featureFiles, madgeEntryDirs[name]);
    writeFileSync(resolve(VISUAL_DIR, `${name}.mmd`), mmd, "utf8");
    mermaidCount++;
  }

  console.log(`  ${mermaidCount} mermaid diagrams → docs/architecture/features/*.mmd`);

  // SVG diagrams via madge + graphviz
  const svgCount = await generateSvgs(features);
  console.log(`  ${svgCount} SVG graphs → docs/architecture/features/*.svg`);
};

// ─── Main ───────────────────────────────────────────────────────────────────

const main = async () => {
  const visualMode = process.argv.includes("--visual");

  const raw = readFileSync(ARCH_FILE, "utf8");
  const doc = parseDocument(raw);
  const yaml = doc.toJSON();

  const features: Record<string, FeatureEntry> = yaml.features ?? {};
  const dataFlows: Record<string, DataFlowEntry> = yaml.data_flows ?? {};

  console.log("arch:codegen — analyzing codebase...\n");

  // Pass 1: Madge
  console.log("Pass 1: madge — tracing feature import trees...");
  const { updated: madgeResults, summary: featureSummary, trees: madgeTrees, entryDirs: madgeEntryDirs } =
    await runMadgePass(features);

  // Pass 2: ts-morph
  console.log("Pass 2: ts-morph — detecting reactive chains...");
  const { updated: tsMorphResults, summary: flowSummary } =
    await runTsMorphPass(dataFlows);

  // Pass 3: Detect new features
  const newFeatures = detectNewFeatures(features);

  // Pass 4: Merge
  console.log("Pass 3: merging into architecture.yml...\n");
  mergeIntoDocument(doc, madgeResults, tsMorphResults, newFeatures);

  // Pass 5: data-attrs inventory
  console.log("Pass 4: scanning data-react-grab-* attributes...");
  const dataAttrsConfig = (yaml.data_attrs ?? {}) as DataAttrsConfig;
  const dataAttrsResult = scanDataAttrs(ROOT, dataAttrsConfig);
  writeInventoryToDoc(doc, dataAttrsResult.inventory);

  // Write
  writeFileSync(
    ARCH_FILE,
    doc.toString({ lineWidth: 0, flowCollectionPadding: false }),
    "utf8",
  );

  // ─── Summary ──────────────────────────────────────────────────────────

  console.log("arch:codegen — architecture.yml updated\n");

  console.log("features:");
  for (const f of featureSummary) {
    const diff = f.after - f.before;
    if (f.before === 0 && f.after === 0) {
      console.log(`  ${f.name}: skipped (files: [])`);
    } else if (diff === 0) {
      console.log(`  ${f.name}: ${f.after} files (unchanged)`);
    } else {
      const sign = diff > 0 ? "+" : "";
      console.log(`  ${f.name}: ${f.after} files (was ${f.before}) — ${sign}${diff} discovered`);
    }
  }

  if (flowSummary.length > 0) {
    console.log("\ndata_flows:");
    for (const f of flowSummary) {
      if (f.before === f.after) {
        console.log(`  ${f.path}: ${f.after} consumers (unchanged)`);
      } else {
        console.log(`  ${f.path}: ${f.after} consumers (was ${f.before})`);
      }
    }
  }

  if (newFeatures.length > 0) {
    console.log("\nNEW features detected (not in YAML):");
    for (const f of newFeatures) console.log(`  ${f}`);
  } else {
    console.log("\nNEW features detected (not in YAML):\n  none");
  }

  // data_attrs summary
  const totalAttrs = Object.keys(dataAttrsResult.inventory).length;
  const attrsBySource = Object.values(dataAttrsResult.inventory).reduce(
    (acc, entry) => {
      if (entry.src > 0) acc.inSrc++;
      if (entry.tests > 0) acc.inTests++;
      return acc;
    },
    { inSrc: 0, inTests: 0 },
  );
  console.log("\ndata_attrs:");
  console.log(
    `  ${totalAttrs} attrs scanned (${attrsBySource.inSrc} in src/, ${attrsBySource.inTests} in tests)`,
  );
  if (dataAttrsResult.orphans.length > 0) {
    console.log(
      `  ${dataAttrsResult.orphans.length} orphan(s) (run pnpm arch:lint for details)`,
    );
  }

  console.log("\nChanges written to architecture.yml. Review the diff before committing.");

  // Visual generation (opt-in)
  if (visualMode) {
    console.log("\nGenerating visuals...");
    await generateVisuals(features, madgeTrees, madgeEntryDirs, madgeResults);
  }
};

main().catch((err) => {
  console.error("arch:codegen failed:", err);
  process.exit(1);
});
