---
status: draft
date: 2026-04-16
references: [PRD-015, ADR-0015, SPEC-006]
---

# SPEC-018 Due Date Filter in Sidebar

## Overview

Implements PRD-015 per ADR-0015: add a fifth `Select` to the sidebar `FilterBar` that filters the visible groups by due date using six presets (`Overdue`, `Due today`, `This week`, `Next 7 days`, `No due date`, plus the default `All due dates`).

Extends the existing client-side filter pipeline in `features/sidebar/filter-state.ts` — no new primitives, no new HTTP endpoints, no new sync-server routes. Touches three source files (`filter-state.ts`, `filter-bar.tsx`, `filter-state.test.ts`), adds one new E2E spec (`e2e/mocked/due-date-filter.spec.ts`), and builds on the `Select` primitive already used by the other four filters in the same bar.

The preset vocabulary (keys + labels + JQL clauses) is centralised in a `DUE_DATE_PRESETS` constant so that if a future server-side JQL refetch pathway is introduced, it can import the same clauses without reinventing the mapping.

## Technical Design

### Layer 1 — Preset model (SSOT)

**File:** `packages/react-grab/src/features/sidebar/filter-state.ts`

A single source of truth for the six presets lives at the top of `filter-state.ts`. Each preset is a record with `key` (union literal), `label` (visible in the Select), and `jql` (the equivalent JQL clause, string-only for documentation and future reuse).

```ts
export type DueDatePreset =
  | "overdue"
  | "today"
  | "this-week"
  | "next-7"
  | "none";

export interface DueDatePresetSpec {
  key: DueDatePreset;
  label: string;
  jql: string;
}

export const DUE_DATE_PRESETS: readonly DueDatePresetSpec[] = [
  { key: "overdue",   label: "Overdue",      jql: "duedate < now()" },
  { key: "today",     label: "Due today",    jql: "duedate = now()" },
  { key: "this-week", label: "This week",    jql: "duedate >= startOfWeek() AND duedate <= endOfWeek()" },
  { key: "next-7",    label: "Next 7 days",  jql: "duedate >= now() AND duedate <= 7d" },
  { key: "none",      label: "No due date",  jql: "duedate is EMPTY" },
] as const;

export const DUE_DATE_PRESET_LABEL_ALL = "All due dates";
```

Rationale for the literal-union + const-array pairing:

- The union `DueDatePreset` gives exhaustiveness to the matcher switch
- The `as const` array gives a single iterable for the `Select` options and for documentation
- Adding a preset later means editing one place: add to the union and push to the array

### Layer 2 — Matchers (pure, testable)

**Same file.** Pure functions, no signals, no side effects. Unit-testable in isolation.

```ts
const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (d: Date, days: number): Date => {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
};

const startOfWeek = (from: Date): Date => {
  // Monday-based week, matches JQL's startOfWeek() on Atlassian Cloud (org-configured; Monday by default for ATT)
  const day = from.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(from, mondayOffset);
};

const endOfWeek = (from: Date): Date => addDays(startOfWeek(from), 6);

const parseDueDate = (raw: string | null | undefined): Date | null => {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

type Matcher = (group: SelectionGroupWithJira, today: Date) => boolean;

const MATCHERS: Record<DueDatePreset, Matcher> = {
  overdue:     (g, today) => { const d = parseDueDate(g.jiraDueDate); return d !== null && d < today; },
  today:       (g, today) => { const d = parseDueDate(g.jiraDueDate); return d !== null && +d === +today; },
  "this-week": (g, today) => {
    const d = parseDueDate(g.jiraDueDate);
    return d !== null && d >= startOfWeek(today) && d <= endOfWeek(today);
  },
  "next-7":    (g, today) => {
    const d = parseDueDate(g.jiraDueDate);
    return d !== null && d >= today && d <= addDays(today, 7);
  },
  none:        (g) => parseDueDate(g.jiraDueDate) === null,
};

export const matchesDueDatePreset = (
  group: SelectionGroupWithJira,
  preset: DueDatePreset,
  today: Date = startOfToday(),
): boolean => MATCHERS[preset](group, today);
```

The `today` parameter is defaulted to `startOfToday()` so production callers don't pass it, but tests can inject a fixed date for determinism (no clock mocking needed).

### Layer 3 — FilterState extension

**Same file.** The only change to the existing `FilterState` surface is one new nullable field. All existing consumers of `FilterState` that use object spread (`{ ...props.filter, statuses }`) continue to work without modification — `dueDatePreset` passes through unchanged when another field is updated.

```ts
export interface FilterState {
  statuses: Set<string>;
  assignee: string | null;
  reporter: string | null;
  label: string | null;
  dueDatePreset: DueDatePreset | null;   // NEW
}

export const EMPTY_FILTER: FilterState = {
  statuses: new Set(),
  assignee: null,
  reporter: null,
  label: null,
  dueDatePreset: null,                   // NEW
};

export function isFilterActive(filter: FilterState): boolean {
  return (
    filter.statuses.size > 0 ||
    filter.assignee !== null ||
    filter.reporter !== null ||
    filter.label !== null ||
    filter.dueDatePreset !== null         // NEW
  );
}

export function applyFilters(
  groups: SelectionGroupWithJira[],
  filter: FilterState,
): SelectionGroupWithJira[] {
  if (!isFilterActive(filter)) return groups;
  return groups.filter((g) => {
    const status = getStatusLabel(g);
    if (filter.statuses.size > 0 && !filter.statuses.has(status)) return false;
    if (filter.assignee && g.jiraAssignee !== filter.assignee) return false;
    if (filter.reporter && g.jiraReporter !== filter.reporter) return false;
    if (filter.label && !(g.jiraLabels ?? []).includes(filter.label)) return false;
    if (filter.dueDatePreset && !matchesDueDatePreset(g, filter.dueDatePreset)) return false;  // NEW
    return true;
  });
}
```

The AND-chain semantics (each filter is a short-circuit) match the existing four filters exactly. Composition is free.

### Layer 4 — FilterBar UI

**File:** `packages/react-grab/src/components/sidebar/filter-bar.tsx`

Add one handler, one `<Select>`, and update the clear logic. The new Select sits **after** Label in source order (matches PRD-015 R15). The `triggerClass` is reused unchanged — identical height, font-size, background, border to the other four.

```tsx
import {
  type FilterState,
  DUE_DATE_PRESETS,
  DUE_DATE_PRESET_LABEL_ALL,
  type DueDatePreset,
} from "../../features/sidebar/filter-state.js";

// ... inside FilterBar:

const handleDueDateChange = (value: string | null) => {
  props.onFilterChange({
    ...props.filter,
    dueDatePreset: (value as DueDatePreset) || null,
  });
};

const hasActiveFilter = () =>
  props.filter.statuses.size > 0 ||
  props.filter.assignee !== null ||
  props.filter.reporter !== null ||
  props.filter.label !== null ||
  props.filter.dueDatePreset !== null;

const handleClear = () => {
  props.onFilterChange({
    statuses: new Set(),
    assignee: null,
    reporter: null,
    label: null,
    dueDatePreset: null,
  });
};

// JSX — appended after the labels <Show>:
<Select
  value={props.filter.dueDatePreset ?? ""}
  onChange={handleDueDateChange}
  placeholder={DUE_DATE_PRESET_LABEL_ALL}
  options={["", ...DUE_DATE_PRESETS.map((p) => p.key)]}
  itemComponent={(itemProps) => (
    <SelectItem item={itemProps.item}>
      {itemProps.item.rawValue === ""
        ? DUE_DATE_PRESET_LABEL_ALL
        : (DUE_DATE_PRESETS.find((p) => p.key === itemProps.item.rawValue)?.label ?? itemProps.item.rawValue)}
    </SelectItem>
  )}
>
  <SelectTrigger class={triggerClass} data-react-grab-due-date-filter>
    <SelectValue<string>>
      {(state) => {
        const key = state.selectedOption();
        return key ? (DUE_DATE_PRESETS.find((p) => p.key === key)?.label ?? key) : DUE_DATE_PRESET_LABEL_ALL;
      }}
    </SelectValue>
  </SelectTrigger>
  <SelectContent />
</Select>
```

The `data-react-grab-due-date-filter` attribute on the trigger follows the package convention (see `packages/react-grab/CLAUDE.md` → Data attributes) so Playwright can target it without relying on visible text.

### Layer 5 — Sidebar wiring

**File:** `packages/react-grab/src/components/sidebar/index.tsx`

**No changes required.** The Sidebar already destructures `{ applyFilters, isFilterActive }` from `filter-state.ts` and calls `applyFilters(userFacingGroups(), filter)` in both the `filteredGroups` memo (line 146) and the `onFilterVisibilityChange` effect (line 164). Because `applyFilters` reads `filter.dueDatePreset` internally, the new field flows through transparently. The existing reactive pipeline picks it up without modification.

### Layer 6 — Unit tests (colocated)

**File (new):** `packages/react-grab/src/features/sidebar/filter-state.test.ts`

If the file already exists, append; otherwise create it following the pattern used in `features/selection-groups/business/*.test.ts`.

Tests cover the matcher in isolation (not the full `applyFilters` chain — that is covered by the E2E test).

```ts
import { describe, it, expect } from "vitest";
import { matchesDueDatePreset, DUE_DATE_PRESETS } from "./filter-state";
import type { SelectionGroupWithJira } from "./jira-types";

const makeGroup = (jiraDueDate: string | null): SelectionGroupWithJira => ({
  // minimum viable shape for the matcher
  id: "g1", jiraDueDate, jiraAssignee: null, jiraReporter: null, jiraLabels: [],
  // ... other required fields filled with null/empty per type
} as SelectionGroupWithJira);

const day = (offset: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString();
};

describe("matchesDueDatePreset", () => {
  it("DUE_DATE_PRESETS exposes all five preset keys", () => {
    expect(DUE_DATE_PRESETS.map((p) => p.key)).toEqual([
      "overdue", "today", "this-week", "next-7", "none",
    ]);
  });

  it("overdue matches past-due tickets", () => {
    expect(matchesDueDatePreset(makeGroup(day(-1)), "overdue")).toBe(true);
    expect(matchesDueDatePreset(makeGroup(day(0)),  "overdue")).toBe(false);
    expect(matchesDueDatePreset(makeGroup(day(1)),  "overdue")).toBe(false);
    expect(matchesDueDatePreset(makeGroup(null),    "overdue")).toBe(false);
  });

  it("today matches only today's date", () => {
    expect(matchesDueDatePreset(makeGroup(day(0)),  "today")).toBe(true);
    expect(matchesDueDatePreset(makeGroup(day(-1)), "today")).toBe(false);
    expect(matchesDueDatePreset(makeGroup(day(1)),  "today")).toBe(false);
  });

  it("next-7 matches today through today+7 inclusive", () => {
    expect(matchesDueDatePreset(makeGroup(day(0)),  "next-7")).toBe(true);
    expect(matchesDueDatePreset(makeGroup(day(7)),  "next-7")).toBe(true);
    expect(matchesDueDatePreset(makeGroup(day(8)),  "next-7")).toBe(false);
    expect(matchesDueDatePreset(makeGroup(day(-1)), "next-7")).toBe(false);
  });

  it("this-week matches within current Monday–Sunday range", () => {
    // spot-check: today is always in this week
    expect(matchesDueDatePreset(makeGroup(day(0)), "this-week")).toBe(true);
    expect(matchesDueDatePreset(makeGroup(day(-8)), "this-week")).toBe(false);
    expect(matchesDueDatePreset(makeGroup(day(8)),  "this-week")).toBe(false);
  });

  it("none matches null dueDate only", () => {
    expect(matchesDueDatePreset(makeGroup(null),  "none")).toBe(true);
    expect(matchesDueDatePreset(makeGroup(day(0)), "none")).toBe(false);
  });

  it("ignores invalid date strings (treats as null)", () => {
    expect(matchesDueDatePreset(makeGroup("not-a-date"), "none")).toBe(true);
    expect(matchesDueDatePreset(makeGroup("not-a-date"), "overdue")).toBe(false);
  });
});
```

### Layer 7 — E2E test (mocked)

**File (new):** `packages/react-grab/e2e/mocked/due-date-filter.spec.ts`

Follows the project testing conventions (see `CLAUDE.md` → Decree spec tags). Tagged `@SPEC-018` on the `describe` block, uses `reactGrab.populate()` to seed groups with a spread of due dates, opens the sidebar, drives the new `Select`, and asserts visible card count.

```ts
import { test, expect } from "../fixtures";

test.describe("Due date filter in sidebar", { tag: ["@SPEC-018"] }, () => {
  test("AC-1: default shows all groups regardless of due date", async ({ reactGrab, page }) => {
    await reactGrab.populate({ /* 5 groups: one per bucket + one ticketless */ });
    await reactGrab.openSidebar();
    await expect(page.locator("[data-react-grab-selection-card]")).toHaveCount(5);
  });

  test("AC-2: 'Overdue' shows only past-due tickets", async ({ reactGrab, page }) => {
    await reactGrab.populate(/* mixed due dates */);
    await reactGrab.openSidebar();
    await page.locator("[data-react-grab-due-date-filter]").click();
    await page.getByRole("option", { name: "Overdue" }).click();
    // assert visible card count matches overdue fixtures
  });

  // AC-3..AC-6 — one per preset

  test("AC-7: preset composes with status filter (AND)", async ({ reactGrab, page }) => {
    // pick Status + Due date; assert intersection
  });

  test("AC-8: '✕ Clear' resets due-date preset along with others", async ({ reactGrab, page }) => {
    // select preset, click clear, assert Select shows placeholder
  });
});
```

Fixtures: a new `seedGroupsWithDueDates()` helper in `e2e/mocks/fixtures.ts` produces one group per preset bucket at deterministic offsets (`day(-3)`, `day(0)`, `day(+3)`, `day(+10)`, `null`, plus one group with no JIRA ticket) so each preset's expected count is predictable regardless of when the suite runs.

## Testing Strategy

### Unit (Vitest, colocated)

- `filter-state.test.ts` — one `describe` block per preset, plus a top-level test asserting `DUE_DATE_PRESETS` shape. All matchers tested in isolation with synthetic `SelectionGroupWithJira` stubs. No DOM, no Solid, no network.
- Runs under existing `pnpm --filter react-grab test:unit` or the per-package Vitest config.

### Integration (Playwright mocked, single-project)

- `e2e/mocked/due-date-filter.spec.ts` — tagged `@SPEC-018`. Uses `reactGrab.populate()` (no HTTP, no `mockServer` fixture) since the filter is pure client-side. Each preset has a dedicated test asserting expected `[data-react-grab-selection-card]` count after selection. A final test asserts AND-composition with the Status filter and the `✕ Clear` reset.
- Run with: `pnpm --filter react-grab exec playwright test e2e/mocked/due-date-filter.spec.ts --project=chromium` (never the full suite — see `CLAUDE.md` → E2E Testing).

### Lint / typecheck

- `pnpm typecheck` — verifies `DueDatePreset` union feeds through `FilterState`, `applyFilters`, and `FilterBar` props without `any` escapes.
- `pnpm lint` — oxlint over the touched files; no new rules required.

## Acceptance Criteria

### Preset model

- [ ] `DueDatePreset` union type exported from `features/sidebar/filter-state.ts` with exactly five literals
- [ ] `DUE_DATE_PRESETS` constant exported as `readonly DueDatePresetSpec[]` with five entries in the documented order
- [ ] `DUE_DATE_PRESET_LABEL_ALL` constant exported for the inactive placeholder text
- [ ] Each preset entry includes `key`, `label`, and `jql` fields; JQL strings match PRD-015 R7–R11 verbatim

### Matchers

- [ ] `matchesDueDatePreset(group, preset, today?)` exported as a pure function
- [ ] `parseDueDate` handles `null`, `undefined`, empty string, and invalid date strings by returning `null`
- [ ] `startOfWeek` uses Monday-based week boundaries (Monday → 0, Sunday → 6)
- [ ] Matchers normalise both sides to local midnight so time-of-day does not affect the comparison

### FilterState integration

- [ ] `FilterState` gains one new field: `dueDatePreset: DueDatePreset | null`
- [ ] `EMPTY_FILTER` includes `dueDatePreset: null`
- [ ] `isFilterActive` returns true if `dueDatePreset !== null`
- [ ] `applyFilters` short-circuits on `dueDatePreset` mismatch, same AND-chain pattern as the four existing filters

### FilterBar UI

- [ ] A fifth `<Select>` is rendered in source order after Label
- [ ] The trigger uses the shared `triggerClass` (no new sizing / font / color rules)
- [ ] The trigger has `data-react-grab-due-date-filter` for test targeting
- [ ] The placeholder reads "All due dates" when no preset is selected
- [ ] Selecting a preset calls `onFilterChange` with the new field value, preserving other filters
- [ ] `hasActiveFilter()` includes the due-date preset in its computation
- [ ] `handleClear()` resets `dueDatePreset` to `null` along with the other fields
- [ ] No changes to `components/sidebar/index.tsx` are required (confirmed by diff review)

### Tests

- [ ] `filter-state.test.ts` exists with tests for `overdue`, `today`, `this-week`, `next-7`, `none`, plus invalid-date handling
- [ ] Unit tests pass under Vitest
- [ ] `e2e/mocked/due-date-filter.spec.ts` exists with one test per preset (AC-2 through AC-6)
- [ ] E2E describe block tagged `@SPEC-018`
- [ ] E2E tests for AC-7 (compose with Status) and AC-8 (Clear resets due-date) pass
- [ ] Targeted E2E run passes: `pnpm --filter react-grab exec playwright test e2e/mocked/due-date-filter.spec.ts --project=chromium`

### Quality gates

- [ ] `pnpm typecheck` passes with no new errors
- [ ] `pnpm lint` passes with no new errors
- [ ] No new `as` casts introduced outside the Select-option string→DueDatePreset narrowing in `handleDueDateChange`
- [ ] No new UI primitives added to `components/ui/`
- [ ] No new HTTP routes, no sync-server changes, no generated-client regeneration

### Docs

- [ ] `architecture.yml` regenerated via `pnpm arch:codegen` so the feature's file list is current
- [ ] Decree status transitioned to `review` then `approved` once implementation is complete: `decree status SPEC-018 submit` → `decree status SPEC-018 approve`

### Deferred (v2)

- [ ] Custom date range — a "Custom range…" preset entry that opens a minimal range dialog
- [ ] Server-side JQL refetch — reusing `DUE_DATE_PRESETS[n].jql` via a new sync-server route
- [ ] "This sprint" / "Next sprint" presets — predicated on sprint metadata becoming part of the sync payload
- [ ] Persist last-selected preset across sessions
