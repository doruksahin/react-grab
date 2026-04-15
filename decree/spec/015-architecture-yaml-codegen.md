---
status: implemented
date: 2026-04-15
references:
- ADR-0012
---

# SPEC-015 Architecture YAML codegen

## Overview

A codegen script that reads the codebase with madge (module graph) and ts-morph (AST analysis), then generates/merges machine-derivable sections of `architecture.yml` — specifically `features.*.files` lists and `data_flows.*.sources/consumers` chains. Human-authored content (descriptions, statuses, decree links, init_sequence narratives) is preserved via merge rules.

Two pnpm scripts: `pnpm arch:codegen` generates, `pnpm arch:lint` validates.

## Technical Design

### Script: `scripts/arch-codegen.ts`

A single TypeScript script run via `pnpm arch:codegen` (tsx). Reads `architecture.yml`, runs analysis, merges results, writes back.

#### Pass 1: Madge — feature file lists

For each feature in `architecture.yml` that has a `files` array:

1. Find the feature's entry point (first file in `files`, or `index.ts` in the feature dir)
2. Run `madge --json <entry>` to get the full import tree
3. Collect all resolved file paths relative to the repo root
4. Replace `features.<name>.files` with the sorted list

Skip features with `files: []` (planned, not yet implemented).

#### Pass 2: ts-morph — reactive chain detection

Scan `src/features/sync/` (or whatever is listed under `data_flows`) for:

| Pattern | Detected as |
|---|---|
| `createResource(source, fetcher)` | Resource — extract source signal name and fetcher target |
| `createStore<T>()` | Store — extract type name and file path |
| `createMemo(() => expr)` | Derived — extract dependency signals from the expression |
| `setInterval(fn, ms)` | Poller — extract interval and function name |
| `onCleanup(() => clearInterval(...))` | Poller cleanup — confirms managed lifecycle |

For each detected resource/store:
1. Find all files that import the accessor (consumers)
2. Generate `data_flows.<name>.sources.<source>.resource`, `store_path`, `consumers`

#### Pass 3: Merge

Read existing `architecture.yml` as a JS object. Apply merge rules from ADR-0012:

| Field pattern | Rule |
|---|---|
| `features.*.files` | **Replace** with generated list |
| `features.*.description`, `status`, `prds`, `specs`, `adrs` | **Preserve** existing |
| `data_flows.*.sources.*.resource`, `store_path`, `consumers` | **Replace** with generated |
| `data_flows.*.sources.*.trigger` | **Replace** with generated |
| `data_flows.*.description`, `init_sequence` | **Preserve** existing |
| `packages.*` | **Preserve** (stable, rarely changes) |
| `decree.*` | **Preserve** (managed by decree CLI) |
| New features found on disk but not in YAML | **Append** with `description: "TODO"` placeholder |

Write back with `yaml.dump()` preserving comments where possible (use `yaml` npm package with `keepSourceTokens`).

#### Output

The script prints a summary:

```
arch:codegen — architecture.yml updated

features:
  sidebar: 12 files (was 3) — 9 discovered
  sync: 8 files (was 5) — 3 discovered
  jira-comments-write: 13 files (unchanged)

data_flows:
  sync_layer.sources.groups: 4 consumers (was 4)
  sync_layer.sources.comments: 3 consumers (was 3)
  sync_layer.sources.jira_status: 3 consumers (was 3)

NEW features detected (not in YAML):
  none

Changes written to architecture.yml. Review the diff before committing.
```

### Script extension: `scripts/arch-lint.ts`

Extend the existing lint script with:

- `data_flows.*.sources.*.resource` — file exists
- `data_flows.*.sources.*.consumers[]` — each file exists
- Cross-check: every file in `data_flows` consumer lists is also importable from the resource file (madge confirms the dependency)

### pnpm scripts

```json
{
  "arch:codegen": "tsx scripts/arch-codegen.ts",
  "arch:lint": "tsx scripts/arch-lint.ts"
}
```

### Dependencies

Already installed as root devDependencies:
- `madge` — module dependency graphs
- `ts-morph` — TypeScript AST analysis
- `yaml` — YAML parsing with comment preservation (add if not present)

## Testing Strategy

### Unit tests (vitest)

- **Merge logic** — given an existing YAML object and generated data, verify:
  - `features.*.files` is replaced
  - `features.*.description` is preserved
  - New features are appended with `description: "TODO"`
  - `data_flows.*.description` is preserved
  - `data_flows.*.sources.*.consumers` is replaced

- **Pattern detection** — given a ts-morph SourceFile with known patterns:
  - Detects `createResource` calls and extracts source/fetcher
  - Detects `createStore` and extracts type
  - Detects `createMemo` and extracts dependencies
  - Detects `setInterval` + `onCleanup` pairs

### Integration test

- Run `pnpm arch:codegen` on the actual codebase
- Verify output YAML parses without errors
- Verify `pnpm arch:lint` passes after codegen
- Verify human-authored fields survived the merge

### CI

- `pnpm arch:lint` runs in CI (not codegen — codegen is a dev command)
- Fails the build if `architecture.yml` has stale paths

## Acceptance Criteria

### Script setup

- [x] `scripts/arch-codegen.ts` exists and runs via `pnpm arch:codegen`
- [x] `yaml` package installed for comment-preserving YAML parsing
- [x] Script exits 0 on success, non-zero on errors

### Madge pass — feature file lists

- [x] Reads `features` section from `architecture.yml`
- [x] For each feature with a non-empty `files` array, runs madge on the entry point
- [x] Replaces `files` array with the full import tree (sorted, relative paths)
- [x] Skips features with `files: []`
- [x] Preserves `description`, `status`, `prds`, `specs`, `adrs` fields

### ts-morph pass — reactive chain detection

- [x] Scans files listed under `data_flows.*.composition_root`
- [ ] Detects `createResource(source, fetcher)` — extracts resource file and source signal
- [x] Detects `createStore<T>()` — extracts store file path
- [ ] Detects `createMemo(() => ...)` — extracts derived signal dependencies
- [x] Detects `setInterval` + `onCleanup` — extracts poll interval
- [x] For each detected accessor, finds consumer files via import tracing
- [x] Generates `data_flows.*.sources.*.resource`, `store_path`, `trigger`, `consumers`

### Merge rules

- [x] `features.*.files` — replaced with generated list
- [x] `features.*.description`, `status`, `prds`, `specs`, `adrs` — preserved
- [x] `data_flows.*.sources.*.resource`, `store_path`, `consumers` — replaced with generated
- [x] `data_flows.*.description`, `init_sequence` — preserved
- [x] `packages.*` — preserved
- [x] `decree.*` — preserved
- [x] New features found on disk but not in YAML — appended with `description: "TODO"`

### Lint extension

- [x] `pnpm arch:lint` validates `data_flows` file paths
- [x] `pnpm arch:lint` cross-checks consumer lists against madge import trees
- [x] Lint fails with clear error message for each stale path

### Output and DX

- [x] Codegen prints summary showing what changed (files discovered, consumers updated)
- [x] Codegen output is deterministic (same input → same output, no random ordering)
- [x] Generated YAML is readable (proper indentation, comments preserved where possible)
- [x] `pnpm arch:lint` passes after `pnpm arch:codegen`

### Documentation

- [x] `CLAUDE.md` documents `pnpm arch:codegen` and `pnpm arch:lint` commands
- [x] `TESTING.md` or `CLAUDE.md` explains the merge rules (which fields are generated vs preserved)
