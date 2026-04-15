---
status: proposed
date: 2026-04-15
---

# ADR-0012 Architecture YAML codegen via madge and ts-morph

## Context and Problem Statement

`architecture.yml` is a hand-maintained navigation index used by Serena MCP and developers to understand the codebase. It contains package entry points, cross-package feature maps, decree document links, and (recently added) a `data_flows` section documenting reactive data chains.

The problem: **it drifts.** File renames, feature additions, and refactors silently make the YAML stale. During a recent debugging session, we traced a JIRA status poller timing bug for hours — a `data_flows` section would have revealed the init sequence and dependency chain at a glance, but it didn't exist because maintaining it manually is tedious.

We have two tools installed (`madge` for module dependency graphs, `ts-morph` for TypeScript AST analysis) and need to decide how they combine to keep `architecture.yml` honest.

## Decision Drivers

- `architecture.yml` contains both machine-derivable facts (file paths, import trees) and human-authored intent (descriptions, status, decree mappings) — codegen must not overwrite editorial content
- The `data_flows` section documents reactive chains (`createResource` → `createStore` → consumers) which are not visible from import graphs alone — requires AST-level analysis
- The lint script (`scripts/arch-lint.ts`) already validates paths exist but cannot detect missing files or stale reactive chain descriptions
- Developer experience: running a single command should tell you if the YAML is in sync

## Considered Options

### Option A: Lint-only (validate, don't generate)

Extend `scripts/arch-lint.ts` to check more things:
- Stale file paths (already done)
- Unlisted files in `src/features/*/` directories
- Circular dependencies via madge
- `data_flows` source/consumer paths exist on disk

**Pros:** Simple, no generated code to maintain, editorial content stays hand-written.
**Cons:** Doesn't generate the `data_flows` section — still requires manual authoring when reactive chains change. Doesn't catch stale descriptions, only stale paths.

### Option B: Hybrid codegen (generate structure, preserve editorial)

A `scripts/arch-codegen.ts` script that:

1. **Madge pass** — scans `src/features/*/` entry points, generates the `features.*.files` lists from actual import trees. Merges with existing YAML: keeps `description`, `status`, `prds`, `specs` fields, replaces `files` arrays.

2. **ts-morph pass** — scans for `createResource`, `createStore`, `createMemo`, `setInterval` + `onCleanup` patterns. Generates a `data_flows` skeleton with `sources`, `trigger`, `consumers` (by tracing who imports and calls the accessor). Human fills in `description` and `init_sequence`.

3. **Merge strategy** — reads existing `architecture.yml`, generates new sections, deep-merges with a rule: scalar fields with human content (descriptions, statuses) are preserved; array fields with file paths are replaced.

**Pros:** Keeps file lists and reactive chain documentation in sync automatically. Human editorial content preserved via merge.
**Cons:** More complex script (~150-200 lines). Merge logic needs careful testing. Generated output needs review before commit.

### Option C: Full codegen (generate everything, no hand-editing)

Generate the entire `architecture.yml` from code analysis. Descriptions derived from JSDoc/file headers. Status from git history. Decree links from frontmatter `references` fields.

**Pros:** Zero manual maintenance.
**Cons:** Descriptions would be mechanical and low-quality. Status detection is unreliable. Removes the human judgment that makes the YAML useful for onboarding. The `decree` section is already managed by `decree` CLI — duplicating it adds conflict risk.

## Decision Outcome

Chosen option: **Option B (Hybrid codegen)**, because it solves the real problem (stale file lists and missing reactive chains) without sacrificing the human-authored content that makes the YAML useful.

The key insight: `architecture.yml` serves two audiences:
1. **Machines (Serena MCP)** — need accurate file paths and entry points. These should be generated.
2. **Humans (developers)** — need descriptions, status, and init sequence narratives. These should be hand-written.

Option B respects this split. Option A doesn't go far enough (we'd still miss reactive chain changes). Option C goes too far (mechanical descriptions are worse than none).

### Implementation approach

Two pnpm scripts:

- `pnpm arch:codegen` — runs madge + ts-morph, generates/merges into `architecture.yml`
- `pnpm arch:lint` — validates the result (already exists, extend with reactive chain path checks)

The codegen output is committed to git, not generated at build time. This means diffs are reviewable in PRs.

### What each tool contributes

| Tool | Generates | Section |
|---|---|---|
| madge | Module dependency tree per feature entry point | `features.*.files` |
| ts-morph | `createResource`, `createStore`, `createMemo`, `setInterval` pattern detection | `data_flows.*.sources`, `data_flows.*.consumers` |
| Human | Descriptions, init_sequence narratives, decree links, status | Everything else |

### Merge rules

| Field | Rule |
|---|---|
| `features.*.files` | Replace with generated list |
| `features.*.description`, `status`, `prds`, `specs`, `adrs` | Preserve existing |
| `data_flows.*.sources.*.resource`, `store_path`, `consumers` | Replace with generated |
| `data_flows.*.description`, `init_sequence` | Preserve existing |
| `packages.*` | Preserve (rarely changes, entry points are stable) |
| `decree.*` | Preserve (managed by decree CLI) |
