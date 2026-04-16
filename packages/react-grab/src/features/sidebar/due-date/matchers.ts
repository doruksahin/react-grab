/**
 * Due-date filter — client execution layer.
 *
 * Pure-JS matchers that mirror the JQL semantics declared in ./presets.ts.
 * Used by the client-side filter pipeline (applyFilters in filter-state.ts)
 * over already-loaded SelectionGroupWithJira[].
 *
 * If/when a server-side JQL refetch is built (ADR-0015 deferred), this
 * file becomes redundant — the server runs the JQL clauses directly and
 * returns matching tickets. The presets.ts contract survives unchanged.
 */

import type { SelectionGroupWithJira } from "../jira-types.js";
import type { DueDatePreset } from "./presets.js";

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
  // Monday-based week — matches Atlassian's startOfWeek() for the ATT org.
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
  overdue: (g, today) => {
    const d = parseDueDate(g.jiraDueDate);
    return d !== null && d < today;
  },
  today: (g, today) => {
    const d = parseDueDate(g.jiraDueDate);
    return d !== null && d.getTime() === today.getTime();
  },
  "this-week": (g, today) => {
    const d = parseDueDate(g.jiraDueDate);
    return d !== null && d >= startOfWeek(today) && d <= endOfWeek(today);
  },
  "next-7": (g, today) => {
    const d = parseDueDate(g.jiraDueDate);
    return d !== null && d >= today && d <= addDays(today, 7);
  },
  none: (g) => parseDueDate(g.jiraDueDate) === null,
};

/**
 * Test a single group against a preset. `today` is injectable so unit tests
 * stay deterministic without clock-mocking; production callers omit it.
 */
export const matchesDueDatePreset = (
  group: SelectionGroupWithJira,
  preset: DueDatePreset,
  today: Date = startOfToday(),
): boolean => MATCHERS[preset](group, today);
