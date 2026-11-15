import { describe, expect, it } from "vitest";
import { EMPTY_FILTER, type FilterState } from "../filter-state.js";
import type { SelectionGroupWithJira } from "../../selection-groups/types.js";
import { getStatusColor } from "../status-colors.js";
import {
  getSelectedStatus,
  getStatusFilterOptions,
  selectStatus,
} from "./status-filter.js";

const makeGroup = (
  overrides: Partial<SelectionGroupWithJira>,
): SelectionGroupWithJira => ({
  id: `group-${Math.random()}`,
  name: "Group",
  createdAt: 0,
  revealed: false,
  ...overrides,
});

const ticketed = (
  jiraStatus: string,
  overrides: Partial<SelectionGroupWithJira> = {},
) => makeGroup({ jiraTicketId: "ATT-1", jiraStatus, ...overrides });

describe("getStatusFilterOptions", () => {
  it("counts groups per status in workflow order", () => {
    const groups = [
      ticketed("In Progress"),
      makeGroup({}),
      ticketed("To Do"),
      ticketed("In Progress"),
    ];
    const result = getStatusFilterOptions(groups, EMPTY_FILTER);
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
      [makeGroup({}), ticketed("In Progress")],
      EMPTY_FILTER,
    );
    expect(result.options[0].color).toEqual(getStatusColor(undefined));
    expect(result.options[1].color).toEqual(getStatusColor("In Progress"));
  });

  it("puts statuses outside the workflow last", () => {
    const result = getStatusFilterOptions(
      [ticketed("Blocked"), ticketed("Done")],
      EMPTY_FILTER,
    );
    expect(result.options.map((option) => option.status)).toEqual([
      "Done",
      "Blocked",
    ]);
  });

  it("counts against the other filters but not the status filter", () => {
    const groups = [
      ticketed("To Do", { jiraAssignee: "Alice" }),
      ticketed("In Progress", { jiraAssignee: "Alice" }),
      ticketed("In Progress", { jiraAssignee: "Bob" }),
    ];
    const filter: FilterState = {
      ...EMPTY_FILTER,
      assignee: "Alice",
      statuses: new Set(["To Do"]),
    };
    const result = getStatusFilterOptions(groups, filter);
    expect(result.total).toBe(2);
    expect(
      result.options.map((option) => [option.status, option.count]),
    ).toEqual([
      ["To Do", 1],
      ["In Progress", 1],
    ]);
  });

  it("keeps the selected status listed when no group has it", () => {
    const filter = selectStatus(EMPTY_FILTER, "UAT");
    const result = getStatusFilterOptions([ticketed("To Do")], filter);
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
