/**
 * Due-date filter — preset contract layer.
 *
 * This file is the single source of truth for the preset vocabulary and its
 * JQL equivalents. It is deliberately small, dependency-free, and contains
 * NO labels, NO matchers, NO client-only types — so it can be lifted into a
 * shared package (or sync-server schema) when a server-side JQL refetch
 * pathway is built (see ADR-0015 for the deferred plan).
 *
 * Anything that lives here must remain portable to a Worker / Node runtime.
 */

export type DueDatePreset =
  | "overdue"
  | "today"
  | "this-week"
  | "next-7"
  | "none";

/**
 * Render order for the preset list — matches PRD-015 R2 and the FilterBar
 * Select options. The order is the contract; do not sort or filter at call
 * sites.
 */
export const DUE_DATE_PRESET_ORDER: readonly DueDatePreset[] = [
  "overdue",
  "today",
  "this-week",
  "next-7",
  "none",
] as const;

/**
 * Atlassian JQL clauses equivalent to each preset's matcher semantics. These
 * strings are not executed by the client today — the client uses pure-JS
 * matchers (see ./matchers.ts). They exist as the documented contract that
 * a future server-side refetch pathway would dispatch unchanged.
 *
 * Editing rules:
 *   - The matcher in matchers.ts MUST stay semantically equivalent to its
 *     JQL clause here.
 *   - "today" / "now()" assumes Atlassian's local-day semantics (midnight,
 *     instance timezone). The client matchers normalise to local midnight to
 *     match.
 *   - "startOfWeek()" follows the org's configured first-day-of-week
 *     (Monday for ATT). The client matchers hard-code Monday-based weeks to
 *     match.
 */
export const DUE_DATE_PRESET_JQL: Readonly<Record<DueDatePreset, string>> = {
  overdue:     "duedate < now()",
  today:       "duedate = now()",
  "this-week": "duedate >= startOfWeek() AND duedate <= endOfWeek()",
  "next-7":    "duedate >= now() AND duedate <= 7d",
  none:        "duedate is EMPTY",
} as const;
