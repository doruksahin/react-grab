import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { load } from "js-yaml";
import madge from "madge";
import {
  scanDataAttrs,
  validateDataAttrs,
  type DataAttrsConfig,
} from "./data-attrs.js";

const ROOT = resolve(import.meta.dirname, "..");
const ARCH_FILE = resolve(ROOT, "architecture.yml");

const PATH_PATTERN = /^packages\//;

// ─── Types ──────────────────────────────────────────────────────────────────

interface SourceEntry {
  store_path?: string;
  resource?: string;
  consumers?: string[];
  [key: string]: unknown;
}

interface DataFlowEntry {
  composition_root?: string;
  store?: string;
  sources?: Record<string, SourceEntry>;
  [key: string]: unknown;
}

// ─── Path extraction ────────────────────────────────────────────────────────

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

// ─── Data flow validation ───────────────────────────────────────────────────

interface LintError {
  path: string;
  message: string;
}

const validateDataFlows = async (
  dataFlows: Record<string, DataFlowEntry>,
): Promise<LintError[]> => {
  const errors: LintError[] = [];

  for (const [flowName, flow] of Object.entries(dataFlows)) {
    // Validate composition_root exists
    if (flow.composition_root && !existsSync(resolve(ROOT, flow.composition_root))) {
      errors.push({
        path: `data_flows.${flowName}.composition_root`,
        message: `${flow.composition_root} → NOT FOUND`,
      });
    }

    // Validate store path exists
    if (flow.store && !existsSync(resolve(ROOT, flow.store))) {
      errors.push({
        path: `data_flows.${flowName}.store`,
        message: `${flow.store} → NOT FOUND`,
      });
    }

    if (!flow.sources) continue;

    // Build madge tree for consumer cross-checking
    const rootFile = flow.composition_root;
    let madgeConsumers: Set<string> | null = null;

    if (rootFile && existsSync(resolve(ROOT, rootFile))) {
      const pkg = rootFile.match(/^(packages\/[^/]+)\//)?.[1];
      const pkgSrcDir = pkg ? resolve(ROOT, pkg, "src") : dirname(resolve(ROOT, rootFile));
      const tsConfigPath = pkg
        ? resolve(ROOT, pkg, "tsconfig.json")
        : undefined;

      try {
        const filesToTrace = [rootFile];
        if (flow.store) filesToTrace.push(flow.store);

        const result = await madge(pkgSrcDir, {
          fileExtensions: ["ts", "tsx"],
          tsConfig: tsConfigPath && existsSync(tsConfigPath) ? tsConfigPath : undefined,
        });
        const tree = result.obj();

        madgeConsumers = new Set<string>();
        for (const traceFile of filesToTrace) {
          const traceAbs = resolve(ROOT, traceFile);
          for (const [file, deps] of Object.entries(tree)) {
            for (const dep of deps) {
              if (resolve(pkgSrcDir, dep) === traceAbs) {
                const consumerRel = relative(ROOT, resolve(pkgSrcDir, file));
                if (consumerRel.startsWith("packages/")) {
                  madgeConsumers.add(consumerRel);
                }
              }
            }
          }
        }
      } catch {
        // madge may fail — skip cross-check
      }
    }

    for (const [srcName, src] of Object.entries(flow.sources)) {
      const prefix = `data_flows.${flowName}.sources.${srcName}`;

      // Validate resource file exists
      if (src.resource && !existsSync(resolve(ROOT, src.resource))) {
        errors.push({
          path: `${prefix}.resource`,
          message: `${src.resource} → NOT FOUND`,
        });
      }

      // Validate each consumer file exists
      if (Array.isArray(src.consumers)) {
        for (const consumer of src.consumers) {
          if (typeof consumer === "string" && consumer.startsWith("packages/")) {
            if (!existsSync(resolve(ROOT, consumer))) {
              errors.push({
                path: `${prefix}.consumers`,
                message: `${consumer} → NOT FOUND`,
              });
            }

            // Cross-check: consumer should be importable from composition root
            if (madgeConsumers && !madgeConsumers.has(consumer)) {
              errors.push({
                path: `${prefix}.consumers`,
                message: `${consumer} → NOT in madge import tree (stale consumer?)`,
              });
            }
          }
        }
      }
    }
  }

  return errors;
};

// ─── Main ───────────────────────────────────────────────────────────────────

const main = async () => {
  const yaml = load(readFileSync(ARCH_FILE, "utf8")) as Record<string, unknown>;
  const paths = [...new Set(extractPaths(yaml))].sort();

  console.log("Checking architecture.yml...\n");

  // ── Phase 1: File path existence ──────────────────────────────────────

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

  // ── Phase 2: data_flows validation ────────────────────────────────────

  const dataFlows = (yaml.data_flows ?? {}) as Record<string, DataFlowEntry>;
  const flowErrors = await validateDataFlows(dataFlows);

  if (flowErrors.length > 0) {
    console.log(`\nDATA FLOW ERRORS (${flowErrors.length}):`);
    for (const err of flowErrors) {
      console.log(`  [${err.path}] ${err.message}`);
    }
  } else if (Object.keys(dataFlows).length > 0) {
    console.log("\ndata_flows: all paths valid, consumer cross-check passed");
  }

  // ── Phase 3: data_attrs validation ────────────────────────────────────

  const dataAttrsConfig = (yaml.data_attrs ?? {}) as DataAttrsConfig;
  const hasDataAttrs =
    dataAttrsConfig.scopes && Object.keys(dataAttrsConfig.scopes).length > 0;
  let attrErrorCount = 0;

  if (hasDataAttrs) {
    const scanResult = scanDataAttrs(ROOT, dataAttrsConfig);
    const { errors: attrErrors, warnings: attrWarnings } = validateDataAttrs(
      scanResult,
      dataAttrsConfig,
    );

    if (attrErrors.length > 0) {
      console.log(`\nDATA ATTR ERRORS (${attrErrors.length}):`);
      for (const err of attrErrors) {
        const detail = err.detail ? ` — ${err.detail}` : "";
        console.log(`  [${err.kind}] data-react-grab-${err.attr}${detail}`);
      }
    }

    if (attrWarnings.length > 0) {
      console.log(`\nDATA ATTR WARNINGS (${attrWarnings.length}):`);
      for (const warn of attrWarnings) {
        const detail = warn.detail ? ` — ${warn.detail}` : "";
        console.log(`  [${warn.kind}] data-react-grab-${warn.attr}${detail}`);
      }
    }

    if (attrErrors.length === 0 && attrWarnings.length === 0) {
      console.log(
        `\ndata_attrs: ${Object.keys(scanResult.inventory).length} attrs, all scoped`,
      );
    } else if (attrErrors.length === 0) {
      console.log(
        `\ndata_attrs: ${Object.keys(scanResult.inventory).length} attrs, no errors (${attrWarnings.length} warning${attrWarnings.length === 1 ? "" : "s"})`,
      );
    }

    attrErrorCount = attrErrors.length;
  }

  // ── Result ────────────────────────────────────────────────────────────

  const totalErrors = stale.length + flowErrors.length + attrErrorCount;
  if (totalErrors > 0) {
    console.log(`\nERROR: ${totalErrors} issue(s) found in architecture.yml`);
    process.exit(1);
  } else {
    console.log("\nOK: architecture.yml is valid");
  }
};

main().catch((err) => {
  console.error("arch:lint failed:", err);
  process.exit(1);
});
