import { describe, it, expect } from "vitest";
import {
  EMPTY_FILTER,
  isFilterActive,
  applyFilters,
} from "./filter-state.js";
import type { SelectionGroupWithJira } from "./jira-types.js";

// Per-preset matcher tests live in ./due-date/matchers.test.ts. This file only
// covers the FilterState wiring: dueDatePreset's effect on EMPTY_FILTER /
// isFilterActive / applyFilters, and AND-composition with the other filters.
//
// Integration tests below use real-clock-relative offsets because applyFilters
// calls matchesDueDatePreset with the default `today = startOfToday()` (no
// way to inject a date through the filter object).

const isoOffsetFromRealToday = (offsetDays: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
};

const makeGroup = (overrides: Partial<SelectionGroupWithJira>): SelectionGroupWithJira =>
  ({
    id: `g-${Math.random()}`,
    name: "Test group",
    createdAt: 0,
    revealed: false,
    jiraDueDate: null,
    jiraAssignee: null,
    jiraReporter: null,
    jiraLabels: [],
    ...overrides,
  }) as unknown as SelectionGroupWithJira;

describe("FilterState — dueDatePreset integration", () => {
  it("EMPTY_FILTER.dueDatePreset is null", () => {
    expect(EMPTY_FILTER.dueDatePreset).toBeNull();
  });

  it("isFilterActive returns true when only dueDatePreset is set", () => {
    expect(isFilterActive({ ...EMPTY_FILTER, dueDatePreset: "overdue" })).toBe(true);
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
  });

  it("applyFilters narrows by dueDatePreset alone", () => {
    const groups: SelectionGroupWithJira[] = [
      makeGroup({ jiraDueDate: isoOffsetFromRealToday(-3) }), // overdue
      makeGroup({ jiraDueDate: isoOffsetFromRealToday(0) }),  // today
      makeGroup({ jiraDueDate: null }),                       // no date
    ];
    const filter = { ...EMPTY_FILTER, dueDatePreset: "overdue" as const };
    const result = applyFilters(groups, filter);
    expect(result).toHaveLength(1);
    expect(result[0].jiraDueDate).toBe(groups[0].jiraDueDate);
  });

  it("applyFilters composes dueDatePreset with assignee (AND)", () => {
    const groups: SelectionGroupWithJira[] = [
      makeGroup({ jiraDueDate: isoOffsetFromRealToday(-1), jiraAssignee: "alice" }),
      makeGroup({ jiraDueDate: isoOffsetFromRealToday(-1), jiraAssignee: "bob" }),
      makeGroup({ jiraDueDate: isoOffsetFromRealToday(5),  jiraAssignee: "alice" }),
    ];
    const filter = {
      ...EMPTY_FILTER,
      dueDatePreset: "overdue" as const,
      assignee: "alice",
    };
    const result = applyFilters(groups, filter);
    expect(result).toHaveLength(1);
    expect(result[0].jiraAssignee).toBe("alice");
  });
});
