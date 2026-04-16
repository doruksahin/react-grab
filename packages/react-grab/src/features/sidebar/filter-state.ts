import type { SelectionGroupWithJira } from "./jira-types.js";
import { getStatusLabel } from "./status-colors.js";

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
  { key: "overdue",   label: "Overdue",     jql: "duedate < now()" },
  { key: "today",     label: "Due today",   jql: "duedate = now()" },
  { key: "this-week", label: "This week",   jql: "duedate >= startOfWeek() AND duedate <= endOfWeek()" },
  { key: "next-7",    label: "Next 7 days", jql: "duedate >= now() AND duedate <= 7d" },
  { key: "none",      label: "No due date", jql: "duedate is EMPTY" },
] as const;

export const DUE_DATE_PRESET_LABEL_ALL = "All due dates";

export interface FilterState {
  statuses: Set<string>;               // empty = all
  assignee: string | null;             // null = all
  reporter: string | null;             // null = all
  label: string | null;                // null = all
  dueDatePreset: DueDatePreset | null; // null = all
}

export const EMPTY_FILTER: FilterState = {
  statuses: new Set(),
  assignee: null,
  reporter: null,
  label: null,
  dueDatePreset: null,
};

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
  // Monday-based week: matches Atlassian Cloud's startOfWeek() for the ATT org.
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

export const matchesDueDatePreset = (
  group: SelectionGroupWithJira,
  preset: DueDatePreset,
  today: Date = startOfToday(),
): boolean => MATCHERS[preset](group, today);

export function isFilterActive(filter: FilterState): boolean {
  return (
    filter.statuses.size > 0 ||
    filter.assignee !== null ||
    filter.reporter !== null ||
    filter.label !== null ||
    filter.dueDatePreset !== null
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
    if (filter.dueDatePreset && !matchesDueDatePreset(g, filter.dueDatePreset)) return false;
    return true;
  });
}

export function getDistinctAssignees(groups: SelectionGroupWithJira[]): string[] {
  return [...new Set(groups.map(g => g.jiraAssignee).filter(Boolean) as string[])].sort();
}

export function getDistinctReporters(groups: SelectionGroupWithJira[]): string[] {
  return [...new Set(groups.map(g => g.jiraReporter).filter(Boolean) as string[])].sort();
}

export function getDistinctLabels(groups: SelectionGroupWithJira[]): string[] {
  return [...new Set(groups.flatMap(g => g.jiraLabels ?? []).filter(Boolean))].sort();
}
