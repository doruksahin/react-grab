---
status: draft
date: 2026-04-15
references:
- SPEC-013
---

# SPEC-014 SPEC AC Verification Pipeline

## Overview

Automated pipeline that reads decree SPEC acceptance criteria, runs matching Playwright E2E tests, captures screenshots as evidence, and produces a structured verification report linking each AC item to its test result.

The pipeline has three layers:
1. **AC Parser** — extracts acceptance criteria from SPEC markdown files, grouped by H3 subsection
2. **Test Annotations** — Playwright's native `annotation` API tags each test with the AC items it verifies
3. **AC Reporter** — custom Playwright reporter that collates test results by AC annotation and outputs a markdown verification report with screenshot evidence

The first verification target is SPEC-013 (JIRA Comment Write-Back, 7 unchecked items). Specifically, the proof-of-concept targets the 2 easiest items:
- **S7-3**: Insert menu (+): Divider, Code block, Quote (ui-observable — check element exists)
- **S8-1**: "Pro tip: press M to comment" hint (ui-observable — check text visible)

The system is scoped to SPEC-013 for now. Generalization to other SPECs is deferred to v2.

## Technical Design

### Layer 1 — AC Parser

**File:** `packages/react-grab/e2e/lib/ac-parser.ts`

A pure function that reads a SPEC markdown file and returns structured AC data:

```ts
interface AcItem {
  id: string;       // content-derived slug, e.g. "cmd-enter-submits"
  section: string;  // H3 heading text
  sectionIndex: number; // 0-based H3 index (for ordering)
  text: string;     // full checkbox text
  checked: boolean; // true if [x], false if [ ]
}

interface ParsedSpec {
  id: string;           // e.g. "SPEC-013"
  title: string;
  status: string;
  references: string[];
  sections: Array<{
    heading: string;
    items: AcItem[];
  }>;
  summary: {
    total: number;
    checked: number;
    unchecked: number;
  };
}

function parseSpec(filePath: string): ParsedSpec
```

**ID generation:** Content-derived slugs from the checkbox text. Take the first 50 characters, lowercase, replace non-alphanumeric with hyphens, deduplicate with a numeric suffix if needed. Examples:
- "Cmd+Enter submits the comment" → `cmd-enter-submits-the-comment`
- "Route returns 404 when group has no jiraTicketId" → `route-returns-404-when-group-has-no-jiraticketid`

This is stable across insertions, reorderings, and edits to other items. Only changes to the item's own text invalidate the ID.

**Parsing rules:**
- Frontmatter: YAML between `---` delimiters — extract `status`, `references`, `date`
- AC section: everything under `## Acceptance Criteria`
- Subsections: H3 headings (`### ...`)
- Items: regex `^\s*-\s*\[([xX ])\]\s+(.+)$`

**What the parser does NOT do:**
- Classify items by testability (the mapping file handles this)
- Modify the SPEC file
- Call decree CLI

### Layer 2 — AC-to-Test Mapping

**File:** `decree/spec/013-ac-map.yaml` (named after the target SPEC, colocated)

Manual YAML file maintained by the developer. Maps AC item IDs to Playwright test annotations:

```yaml
spec: SPEC-013
file: decree/spec/013-jira-comment-write-back.md
mappings:
  - ac: "cmd-enter-submits-the-comment"
    test: "verify-spec-013.spec.ts::Cmd+Enter submits"
    note: null

  - ac: "escape-cancels-reply-mode"
    test: null
    note: "Requires TipTap focus inside Shadow DOM — not yet testable"

  - ac: "route-returns-404-when-group-has-no-jiraticketid"
    test: null
    note: "Integration test, not E2E"
```

**Fields:**
- `ac` — content-derived slug matching the parser output
- `test` — `null` if not E2E-testable, otherwise `"filename::test title"` matching the Playwright annotation
- `note` — why an item is skipped or has low coverage

No `text`, `category`, or `confidence` fields. The `ac` slug is the link to the SPEC; the `test` field is the link to the code. The `note` explains gaps.

**Who writes this:** The developer. When they write a test for an AC item, they add the mapping entry and the test annotation simultaneously.

### Layer 3 — Test Annotations

Playwright's native annotation API tags tests with AC item IDs:

```ts
test('Insert menu shows Divider, Code block, Quote', {
  annotation: [
    { type: 'ac', description: 'SPEC-013:insert-menu-divider-code-block-quote' },
  ],
}, async ({ page, reactGrab, mockServer }) => {
  // navigate to group detail with JIRA ticket
  // click + button in toolbar
  await reactGrab.screenshot('insert-menu-open');
  // assert 3 items visible
});
```

**Convention:**
- `type: 'ac'` — marks the annotation as an acceptance criteria link
- `description: 'SPEC-NNN:<slug>'` — format is `<spec-id>:<content-derived-slug>`
- One test can verify multiple AC items (multiple annotations)
- One AC item can be verified by multiple tests
- Every annotated test MUST call `reactGrab.screenshot()` at least once — screenshots are attached via `testInfo.attach()` and appear in both the HTML report and the AC reporter output

### Layer 4 — AC Reporter

**File:** `packages/react-grab/e2e/lib/ac-reporter.ts`

Custom Playwright reporter (~80 lines) that runs alongside the HTML reporter.

**Configuration in playwright.config.ts:**

```ts
reporter: [
  ['html'],
  ['./e2e/lib/ac-reporter.ts', {
    mappingDir: '../../decree/spec',  // directory containing *-ac-map.yaml files
    outputDir: './ac-reports',        // where to write verification reports
  }],
]
```

**Reporter behavior:**
1. `onTestEnd(test, result)` — collects `type: 'ac'` annotations, test status, and screenshot attachment paths from `result.attachments`
2. `onEnd(result)` — reads all `*-ac-map.yaml` files from `mappingDir`, merges with collected test results, writes one `ac-verification-{spec-id}.md` per SPEC to `outputDir`

**Verdict logic:**
- AC item has `test` in mapping AND test passed → `PASS`
- AC item has `test` in mapping AND test failed → `FAIL`
- AC item has `test: null` in mapping → `SKIP` (with note)
- AC item has no mapping entry at all → `UNMAPPED`

**Output: `ac-reports/ac-verification-SPEC-013.md`**

```markdown
# SPEC-013 Verification Report — 2026-04-15

## Summary
- Unchecked AC items: 7
- With E2E test: 2
- Verified (PASS): 2
- Failed: 0
- Skipped (not E2E): 5

## Results

| AC | Description | Verdict | Evidence |
|---|---|---|---|
| insert-menu-divider-code-block-quote | Insert menu (+): Divider, Code block, Quote | PASS | [insert-menu-open.png] |
| pro-tip-press-m-to-comment | "Pro tip: press M to comment" hint | PASS | [m-hint-visible.png] |
| cmd-enter-submits-the-comment | Cmd+Enter submits the comment | SKIP | Requires TipTap focus in Shadow DOM |
| escape-cancels-reply-mode | Escape cancels reply mode | SKIP | Requires TipTap focus in Shadow DOM |
| pressing-m-focuses-the-comment-editor | Pressing M focuses the comment editor | SKIP | Keyboard shortcut in overlay |
| cancel-button-clears-editor-content | Cancel button clears editor (with confirmation) | SKIP | Requires non-empty editor state |
| image-upload-failure-graceful | If image upload fails, comment still posts | SKIP | Requires error injection timing |
```

**Reporter prints to stdout:**

```
SPEC-013: 2/7 verified, 0 failed, 5 skipped
```

### Integration with decree

The pipeline does NOT auto-check SPEC boxes. The report is evidence for the developer to review and manually update the SPEC. This is intentional — the gap between "test passed" and "AC satisfied" requires human judgment.

**Workflow:**
1. Run `pnpm verify:spec`
2. Read `ac-reports/ac-verification-SPEC-013.md`
3. Review screenshots in the HTML report (`npx playwright show-report`)
4. Check off verified items in the SPEC: `- [ ]` → `- [x]`
5. Run `decree progress` to see updated completion

### CLI integration

```json
{
  "verify:spec": "playwright test e2e/mocked/ --project=chromium-mocked"
}
```

The reporter is configured in `playwright.config.ts` — it runs automatically when the `chromium-mocked` project is tested. Output goes to `ac-reports/`.

## Testing Strategy

### Unit tests for AC Parser

**File:** `packages/react-grab/e2e/lib/__tests__/ac-parser.test.ts`

- Parse a sample SPEC with mixed checked/unchecked items → correct counts
- Parse H3 subsections → correct grouping
- Content-derived slugs are deterministic and stable
- Duplicate text produces unique slugs (numeric suffix)
- Handle edge cases: no AC section, empty sections, malformed frontmatter, missing file

### Unit tests for AC Reporter

**File:** `packages/react-grab/e2e/lib/__tests__/ac-reporter.test.ts`

- Reporter collects annotations from mock TestCase objects
- Reporter merges with mapping YAML correctly
- Reporter handles tests with no AC annotations (ignored)
- Reporter handles AC items with no matching test (verdict: `SKIP`)
- Reporter handles unmapped items (verdict: `UNMAPPED`)
- Markdown output format matches expected structure

### SPEC-013 Proof-of-Concept

**File:** `packages/react-grab/e2e/mocked/verify-spec-013.spec.ts`

Two annotated tests targeting the 2 easiest unchecked items:
1. **S7-3 (Insert menu)**: Navigate to group detail → find toolbar → click + button → assert 3 options → screenshot
2. **S8-1 (M hint)**: Navigate to group detail → check for hint text → screenshot

The remaining 5 items are mapped as `test: null` with notes explaining why they're not yet testable.

## Acceptance Criteria

### AC Parser

- [ ] `parseSpec(filePath)` reads frontmatter (status, references, date)
- [ ] Parser extracts H3 subsections as groups
- [ ] Parser extracts checkbox items with checked/unchecked state
- [ ] Item IDs are content-derived slugs (first 50 chars, lowercased, hyphenated)
- [ ] Duplicate slugs get numeric suffixes (`-2`, `-3`, etc.)
- [ ] Parser returns `summary` with total, checked, unchecked counts
- [ ] Parser handles SPECs with no `## Acceptance Criteria` section (returns empty)
- [ ] Parser handles missing or malformed files (throws descriptive error)
- [ ] Unit tests pass (6+ test cases)

### AC-to-Test Mapping

- [ ] YAML mapping file format: `ac` (slug), `test` (nullable), `note` (nullable)
- [ ] Mapping file for SPEC-013 created: `decree/spec/013-ac-map.yaml` with all 7 unchecked items
- [ ] Mapping file named after target SPEC, colocated in `decree/spec/`

### Test Annotations

- [ ] Tests use `annotation: [{ type: 'ac', description: 'SPEC-NNN:<slug>' }]`
- [ ] Every annotated test calls `reactGrab.screenshot()` at least once
- [ ] `reactGrab.screenshot()` uses `testInfo.attach()` so screenshots appear in `result.attachments`

### AC Reporter

- [ ] Custom reporter reads `type: 'ac'` annotations from `TestCase.annotations`
- [ ] Reporter accepts `mappingDir` and `outputDir` as constructor options
- [ ] Reporter reads `*-ac-map.yaml` files from `mappingDir`
- [ ] Reporter writes `ac-verification-{spec-id}.md` to `outputDir`
- [ ] Markdown report has: summary, results table (verdict + evidence), skipped table
- [ ] Verdict logic: PASS (test passed), FAIL (test failed), SKIP (test null), UNMAPPED (no mapping)
- [ ] Screenshot filenames referenced in Evidence column
- [ ] Reporter prints one-line summary per SPEC to stdout
- [ ] Unit tests pass (6+ test cases)

### SPEC-013 Proof-of-Concept

- [ ] `verify-spec-013.spec.ts` has 2 annotated tests for S7-3 (Insert menu) and S8-1 (M hint)
- [ ] Both tests PASS with screenshot evidence
- [ ] 5 remaining items mapped as `test: null` with notes
- [ ] `ac-verification-SPEC-013.md` produced with correct format
- [ ] `pnpm verify:spec` runs end-to-end and produces the report
- [ ] Report shows 2 PASS, 5 SKIP, correct summary counts

### Cross-cutting

- [ ] TypeScript compiles with no errors (`pnpm typecheck` or `tsc --noEmit` on e2e files)
- [ ] AC parser has no dependency on decree CLI (pure file I/O + regex)
- [ ] Reporter has no dependency on decree CLI (reads YAML + test results only)
- [ ] All new files in `e2e/lib/` directory

### Deferred (v2)

- [ ] Mapping lint script (validate no orphaned/dead mappings)
- [ ] JSON output (`ac-verification.json`) for CI consumption
- [ ] Auto-generate mapping stubs from unchecked AC items
- [ ] CI integration: run verification on PR and comment results
- [ ] Multi-SPEC batch verification (`pnpm verify:spec --all`)
- [ ] Generalize to work with any decree SPEC (not just SPEC-013)
