import { describe, expect, it } from "vitest";
import {
  DUE_DATE_PRESET_ORDER,
  DUE_DATE_PRESET_JQL,
  type DueDatePreset,
} from "./presets.js";

describe("DUE_DATE_PRESET_ORDER", () => {
  it("exposes the five preset keys in documented order (PRD-015 R2)", () => {
    expect(DUE_DATE_PRESET_ORDER).toEqual([
      "overdue",
      "today",
      "this-week",
      "next-7",
      "none",
    ]);
  });

  it("has no duplicate keys", () => {
    expect(new Set(DUE_DATE_PRESET_ORDER).size).toBe(DUE_DATE_PRESET_ORDER.length);
  });
});

describe("DUE_DATE_PRESET_JQL", () => {
  it("provides a JQL clause for every preset key", () => {
    for (const key of DUE_DATE_PRESET_ORDER) {
      expect(DUE_DATE_PRESET_JQL[key]).toBeTruthy();
      expect(DUE_DATE_PRESET_JQL[key]).toMatch(/duedate/i);
    }
  });

  it("matches the JQL strings declared in PRD-015 R7–R11", () => {
    const expected: Record<DueDatePreset, string> = {
      overdue:     "duedate < now()",
      today:       "duedate = now()",
      "this-week": "duedate >= startOfWeek() AND duedate <= endOfWeek()",
      "next-7":    "duedate >= now() AND duedate <= 7d",
      none:        "duedate is EMPTY",
    };
    expect(DUE_DATE_PRESET_JQL).toEqual(expected);
  });
});
