import { describe, expect, it } from "vitest";
import { getStatusChip } from "./get-status-chip.js";
import { FLAGGED_COLOR } from "./resolve-display-color.js";
import { getStatusColor } from "./status-colors.js";

describe("getStatusChip", () => {
  it("shows No Task in the no-task colour when there is no ticket", () => {
    expect(getStatusChip({})).toEqual({
      label: "No Task",
      color: getStatusColor(undefined),
    });
  });

  it("shows To Do in the To Do colour for a ticket whose status is not polled yet", () => {
    expect(getStatusChip({ jiraTicketId: "ATT-1" })).toEqual({
      label: "To Do",
      color: getStatusColor("To Do"),
    });
  });

  it("shows the polled status in its colour", () => {
    expect(
      getStatusChip({ jiraTicketId: "ATT-1", jiraStatus: "In Progress" }),
    ).toEqual({
      label: "In Progress",
      color: getStatusColor("In Progress"),
    });
  });

  it("keeps the status label but uses the flag colour when flagged", () => {
    expect(
      getStatusChip({
        jiraTicketId: "ATT-1",
        jiraStatus: "In Progress",
        jiraFlagged: true,
      }),
    ).toEqual({ label: "In Progress", color: FLAGGED_COLOR });
  });

  it("uses the flag colour for a flagged group without a ticket", () => {
    expect(getStatusChip({ jiraFlagged: true })).toEqual({
      label: "No Task",
      color: FLAGGED_COLOR,
    });
  });
});
