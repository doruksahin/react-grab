import { describe, expect, it } from "vitest";
import { EMPTY_FILTER } from "../filter-state.js";
import { getStatusColor } from "../status-colors.js";
import {
  getSelectedStatus,
  getStatusFilterOptions,
  selectStatus,
} from "./status-filter.js";

describe("getStatusFilterOptions", () => {
  it("counts selections per status in workflow order", () => {
    const result = getStatusFilterOptions(
      ["In Progress", "No Task", "To Do", "In Progress"],
      EMPTY_FILTER,
    );
    expect(result.total).toBe(4);
    expect(
      result.options.map((option) => [option.status, option.count]),
    ).toEqual([
      ["No Task", 1],
      ["To Do", 1],
      ["In Progress", 2],
    ]);
  });

  it("takes each colour from the status mapping", () => {
    const result = getStatusFilterOptions(
      ["No Task", "In Progress"],
      EMPTY_FILTER,
    );
    expect(result.options[0].color).toEqual(getStatusColor(undefined));
    expect(result.options[1].color).toEqual(getStatusColor("In Progress"));
  });

  it("puts statuses outside the workflow last", () => {
    const result = getStatusFilterOptions(["Blocked", "Done"], EMPTY_FILTER);
    expect(result.options.map((option) => option.status)).toEqual([
      "Done",
      "Blocked",
    ]);
  });

  it("keeps the selected status listed when no selection has it", () => {
    const filter = selectStatus(EMPTY_FILTER, "UAT");
    const result = getStatusFilterOptions(["To Do"], filter);
    expect(
      result.options.map((option) => [option.status, option.count]),
    ).toEqual([
      ["To Do", 1],
      ["UAT", 0],
    ]);
  });
});

describe("selectStatus", () => {
  it("selects one status and keeps the other filters", () => {
    const filter = selectStatus(
      { ...EMPTY_FILTER, label: "ui", statuses: new Set(["To Do"]) },
      "Done",
    );
    expect([...filter.statuses]).toEqual(["Done"]);
    expect(filter.label).toBe("ui");
    expect(getSelectedStatus(filter)).toBe("Done");
  });

  it("clears the status filter for null", () => {
    const filter = selectStatus(selectStatus(EMPTY_FILTER, "Done"), null);
    expect(filter.statuses.size).toBe(0);
    expect(getSelectedStatus(filter)).toBeNull();
  });
});
