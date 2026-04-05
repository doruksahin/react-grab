---
date: '2026-04-05'
references:
- PRD-002
- ADR-0002
status: accepted
---

# ADR-0004 Markdown to ADF conversion for JIRA ticket description

## Context and Problem Statement

Phase 3 (PRD-002) requires the sidebar's JIRA create dialog to include a description field — auto-generated markdown summarising the group name, component names, selections, and element selectors — that is submitted to the JIRA REST API v3. The JIRA Cloud API v3 `description` field requires an **Atlassian Document Format (ADF)** object (`{ "version": 1, "type": "doc", "content": [...] }`). Passing a plain string is rejected or stored as unstyled literal text. The `buildDescription` helper in the original integration plan returned a markdown string with an incorrect comment claiming that `jira.js` auto-converts it to ADF — it does not. We must choose how to produce a valid ADF object from the markdown string we already know how to generate. [R-002](../../docs/risks.md)

## Decision Drivers

- The JIRA Cloud API v3 rejects plain-text description fields — ADF is required, not optional
- The sync-server runs on Cloudflare Workers — any conversion library must be Workers-safe (no Node built-ins)
- The description content is structured markdown (headings, bold, code spans, lists) — a real renderer is needed, not just paragraph wrapping
- Bundle size: `packages/react-grab` is a third-party injected script; conversion library weight matters
- The library must have TypeScript types without a separate `@types/` package
- The description field is user-editable (PRD-002) — arbitrary markdown input must be handled, not just a fixed template

## Considered Options

### Option A: `marklassian` (v1.2.1)

A dedicated markdown → ADF converter. 12.9 kB gzip. Single dependency (`marked`). Built-in TypeScript. MIT license. Published March 2026 (13 days before the research scan). 27,051 weekly downloads. No Node built-ins — confirmed Workers-safe.

```typescript
import { markdownToADF } from "marklassian";
const adf = markdownToADF(markdownString); // returns ADF Document object
```

- Good: purpose-built for this exact conversion; API is a single function
- Good: Workers-safe — pure JS, no Node built-ins
- Good: 12.9 kB gzip is acceptable for the value delivered
- Good: actively maintained (recent publish, growing downloads)
- Good: built-in TypeScript — no `@types/` needed
- Neutral: depends on `marked` (a well-maintained markdown parser); acceptable transitive dependency

### Option B: `@atlaskit/editor-markdown-transformer`

Atlassian's own markdown-to-ADF transformer, extracted from the Atlaskit editor.

- Good: maintained by Atlassian — first-party knowledge of ADF schema evolution
- Good: 29k weekly downloads
- Bad: pulls in the full Atlaskit editor tree + ProseMirror (~100+ kB gzip additional bundle) — unacceptable for a third-party injected script
- Bad: not documented as Workers-safe — the Atlaskit editor is browser-targeted and may use browser-specific APIs
- Bad: installing an Atlaskit package introduces the Atlassian license ecosystem into `packages/react-grab`

### Option C: `md-to-adf`

An older markdown → ADF library.

- Good: purpose-built for this conversion
- Bad: abandoned — last published 6 years ago; no TypeScript support
- Bad: ADF schema has evolved since the library was written — likely produces outdated ADF structures
- Bad: no TypeScript — types would have to be written manually

### Option D: Hand-write ADF construction (no library)

Implement `buildDescription` by directly constructing the ADF JSON structure, manually building the required node types (paragraph, heading, bulletList, codeBlock, text with marks).

- Good: zero new dependencies; full control over output structure
- Neutral: the ADF schema for the subset we use is documented and stable
- Bad: hand-writing ADF is verbose and brittle — any change to the description template requires updating both markdown and the ADF builder in sync
- Bad: re-implements what a library already solves, with no type-safety on the ADF output shape
- Bad: user edits to the description field may introduce markdown that the hand-written builder does not handle

## Decision Outcome

**Option A: `marklassian`**, because:

1. **Workers-safe and lightweight.** At 12.9 kB gzip with one transitive dependency (`marked`), it is the smallest viable option for addition to `packages/sync-server`. The Atlaskit transformer (Option B) is an order of magnitude larger with uncertain Workers compatibility. [R-002](../../docs/risks.md)

2. **User edits require a real renderer.** The description field is user-editable (PRD-002). A hand-written ADF builder (Option D) would need to handle arbitrary markdown from user input. A library handles this correctly without a bespoke parser.

3. **Active and typed.** `marklassian` was published in March 2026, has TypeScript built-in, and is growing in downloads. `md-to-adf` (Option C) is abandoned with no TypeScript.

4. **Correct API contract.** The JIRA v3 API requires ADF; there is no plain-text fallback. [R-002](../../docs/risks.md)

The integration point is the `buildDescription` helper: it assembles the markdown string (same as before), then returns `markdownToADF(markdown)` instead of the raw string. The return type changes from `string` to `object` (the ADF document). This object is passed directly as `fields.description` in the JIRA create-issue request body.

## Consequences

- `marklassian` is added as a runtime dependency to **`packages/sync-server`** — this is where `JiraService.buildDescription()` lives (`src/services/jira.service.ts:166`), which is the single point where the markdown description becomes the JIRA API payload
- The sidebar sends the user's description as a markdown string to the sync-server's JIRA proxy endpoint; the server converts it to ADF before calling the JIRA REST API — the sidebar never handles ADF
- `buildDescription` return type changes from `string` to the ADF `Document` object exported by `marklassian`; the existing incorrect comment ("jira.js auto-converts plain text to ADF", line 61) is removed
- The JIRA create-issue request body passes the ADF object directly as `fields.description`
- `md-to-adf`, `adf-builder`, and `@atlaskit/editor-markdown-transformer` are **not** installed
- `marklassian` is **not** added to `packages/react-grab` — the sidebar has no ADF concern
