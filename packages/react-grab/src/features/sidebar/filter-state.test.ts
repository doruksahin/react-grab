import { describe, it, expect } from "vitest";
import {
  matchesDueDatePreset,
  DUE_DATE_PRESETS,
  DUE_DATE_PRESET_LABEL_ALL,
  EMPTY_FILTER,
  isFilterActive,
  applyFilters,
} from "./filter-state.js";
import type { SelectionGroupWithJira } from "./jira-types.js";

const makeGroup = (jiraDueDate: string | null): SelectionGroupWithJira =>
  ({
    id: "g1",
    name: "Test group",
    createdAt: 0,
    revealed: false,
    jiraDueDate,
    jiraAssignee: null,
    jiraReporter: null,
    jiraLabels: [],
  }) as unknown as SelectionGroupWithJira;

// Fixed "today" reference — all matchers accept an injected `today` so tests
// do not depend on the current clock.
const makeToday = (): Date => {
  const d = new Date(2026, 3, 15); // Wed Apr 15 2026 (local midnight)
  d.setHours(0, 0, 0, 0);
  return d;
};

const isoOffsetFromToday = (offsetDays: number): string => {
  const d = makeToday();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
};

describe("DUE_DATE_PRESETS", () => {
  it("exposes the five preset keys in documented order", () => {
    expect(DUE_DATE_PRESETS.map((p) => p.key)).toEqual([
      "overdue",
      "today",
      "this-week",
      "next-7",
      "none",
    ]);
  });

  it("every preset has a human label and a JQL clause", () => {
    for (const preset of DUE_DATE_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.jql.length).toBeGreaterThan(0);
    }
  });

  it("DUE_DATE_PRESET_LABEL_ALL is the inactive placeholder", () => {
    expect(DUE_DATE_PRESET_LABEL_ALL).toBe("All due dates");
  });
});

describe("matchesDueDatePreset — overdue", () => {
  const today = makeToday();

  it("matches past-due tickets", () => {
    expect(matchesDueDatePreset(makeGroup(isoOffsetFromToday(-1)), "overdue", today)).toBe(true);
    expect(matchesDueDatePreset(makeGroup(isoOffsetFromToday(-30)), "overdue", today)).toBe(true);
  });

  it("does not match today's tickets", () => {
    expect(matchesDueDatePreset(makeGroup(isoOffsetFromToday(0)), "overdue", today)).toBe(false);
  });

  it("does not match future tickets", () => {
    expect(matchesDueDatePreset(makeGroup(isoOffsetFromToday(1)), "overdue", today)).toBe(false);
  });

  it("does not match null dueDate", () => {
    expect(matchesDueDatePreset(makeGroup(null), "overdue", today)).toBe(false);
  });
});

describe("matchesDueDatePreset — today", () => {
  const today = makeToday();

  it("matches only today's date", () => {
    expect(matchesDueDatePreset(makeGroup(isoOffsetFromToday(0)), "today", today)).toBe(true);
  });

  it("does not match yesterday or tomorrow", () => {
    expect(matchesDueDatePreset(makeGroup(isoOffsetFromToday(-1)), "today", today)).toBe(false);
    expect(matchesDueDatePreset(makeGroup(isoOffsetFromToday(1)), "today", today)).toBe(false);
  });

  it("ignores time-of-day on the stored date (normalises to midnight)", () => {
    const atNoon = makeToday();
    atNoon.setHours(14, 30, 0, 0);
    expect(matchesDueDatePreset(makeGroup(atNoon.toISOString()), "today", today)).toBe(true);
  });
});

describe("matchesDueDatePreset — this-week", () => {
  // Wed Apr 15 2026; Monday of that week = Apr 13, Sunday = Apr 19.
  const today = makeToday();

  it("matches a date within Monday–Sunday range", () => {
    expect(matchesDueDatePreset(makeGroup(isoOffsetFromToday(0)), "this-week", today)).toBe(true);
    expect(matchesDueDatePreset(makeGroup(isoOffsetFromToday(-2)), "this-week", today)).toBe(true); // Monday
    expect(matchesDueDatePreset(makeGroup(isoOffsetFromToday(4)), "this-week", today)).toBe(true);  // Sunday
  });

  it("does not match the day before Monday or after Sunday", () => {
    expect(matchesDueDatePreset(makeGroup(isoOffsetFromToday(-3)), "this-week", today)).toBe(false); // previous Sunday
    expect(matchesDueDatePreset(makeGroup(isoOffsetFromToday(5)), "this-week", today)).toBe(false);  // next Monday
  });

  it("handles Sunday as the end of the current week, not the start of the next", () => {
    // Simulate a Sunday: Apr 19 2026
    const sunday = new Date(2026, 3, 19);
    sunday.setHours(0, 0, 0, 0);
    const monday = new Date(2026, 3, 13);
    monday.setHours(0, 0, 0, 0);
    expect(matchesDueDatePreset(makeGroup(sunday.toISOString()), "this-week", sunday)).toBe(true);
    expect(matchesDueDatePreset(makeGroup(monday.toISOString()), "this-week", sunday)).toBe(true);
  });
});

describe("matchesDueDatePreset — next-7", () => {
  const today = makeToday();

  it("matches today through today+7 inclusive", () => {
    expect(matchesDueDatePreset(makeGroup(isoOffsetFromToday(0)), "next-7", today)).toBe(true);
    expect(matchesDueDatePreset(makeGroup(isoOffsetFromToday(7)), "next-7", today)).toBe(true);
  });

  it("does not match day 8 or later", () => {
    expect(matchesDueDatePreset(makeGroup(isoOffsetFromToday(8)), "next-7", today)).toBe(false);
  });

  it("does not match past-due tickets", () => {
    expect(matchesDueDatePreset(makeGroup(isoOffsetFromToday(-1)), "next-7", today)).toBe(false);
  });
});

describe("matchesDueDatePreset — none", () => {
  const today = makeToday();

  it("matches null dueDate", () => {
    expect(matchesDueDatePreset(makeGroup(null), "none", today)).toBe(true);
  });

  it("does not match any dated ticket", () => {
    expect(matchesDueDatePreset(makeGroup(isoOffsetFromToday(0)), "none", today)).toBe(false);
    expect(matchesDueDatePreset(makeGroup(isoOffsetFromToday(-5)), "none", today)).toBe(false);
    expect(matchesDueDatePreset(makeGroup(isoOffsetFromToday(30)), "none", today)).toBe(false);
  });

  it("treats invalid date strings as null (matches 'none')", () => {
    expect(matchesDueDatePreset(makeGroup("not-a-date"), "none", today)).toBe(true);
    expect(matchesDueDatePreset(makeGroup(""), "none", today)).toBe(true);
  });

  it("treats invalid date strings as null (does NOT match 'overdue')", () => {
    expect(matchesDueDatePreset(makeGroup("not-a-date"), "overdue", today)).toBe(false);
  });
});

// For integration tests that exercise applyFilters end-to-end, we must use the
// real current clock — applyFilters calls matchesDueDatePreset with the default
// `today = startOfToday()`, so offsets have to be relative to the real today.
const isoOffsetFromRealToday = (offsetDays: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
};

describe("FilterState integration", () => {
  it("EMPTY_FILTER.dueDatePreset is null", () => {
    expect(EMPTY_FILTER.dueDatePreset).toBeNull();
  });

  it("isFilterActive returns true when only dueDatePreset is set", () => {
    expect(isFilterActive({ ...EMPTY_FILTER, dueDatePreset: "overdue" })).toBe(true);
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
  });

  it("applyFilters narrows by dueDatePreset alone", () => {
    const groups: SelectionGroupWithJira[] = [
      makeGroup(isoOffsetFromRealToday(-3)), // overdue
      makeGroup(isoOffsetFromRealToday(0)),  // today
      makeGroup(null),                       // no date
    ];
    const filter = { ...EMPTY_FILTER, dueDatePreset: "overdue" as const };
    const result = applyFilters(groups, filter);
    expect(result).toHaveLength(1);
    expect(result[0].jiraDueDate).toBe(groups[0].jiraDueDate);
  });

  it("applyFilters composes dueDatePreset with assignee (AND)", () => {
    const withAssignee = (due: string | null, assignee: string | null): SelectionGroupWithJira =>
      ({
        id: `g-${Math.random()}`,
        name: "t",
        createdAt: 0,
        revealed: false,
        jiraDueDate: due,
        jiraAssignee: assignee,
        jiraReporter: null,
        jiraLabels: [],
      }) as unknown as SelectionGroupWithJira;

    const groups: SelectionGroupWithJira[] = [
      withAssignee(isoOffsetFromRealToday(-1), "alice"),
      withAssignee(isoOffsetFromRealToday(-1), "bob"),
      withAssignee(isoOffsetFromRealToday(5),  "alice"),
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
