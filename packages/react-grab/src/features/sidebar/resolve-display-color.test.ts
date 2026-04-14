import { describe, expect, it } from "vitest";
import { FLAGGED_COLOR, resolveDisplayColor } from "./resolve-display-color.js";

describe("resolveDisplayColor — business rule: flagged overrides status", () => {
  it("returns FLAGGED_COLOR when jiraFlagged is true, regardless of status", () => {
    expect(resolveDisplayColor("In Progress", true)).toBe(FLAGGED_COLOR);
    expect(resolveDisplayColor("Code Review", true)).toBe(FLAGGED_COLOR);
    expect(resolveDisplayColor("Won't Do", true)).toBe(FLAGGED_COLOR);
    expect(resolveDisplayColor("Done", true)).toBe(FLAGGED_COLOR);
    expect(resolveDisplayColor(undefined, true)).toBe(FLAGGED_COLOR);
  });

  it("falls through to getStatusColor when not flagged", () => {
    const result = resolveDisplayColor("In Progress", false);
    expect(result.hex).toBe("#3b82f6");
  });

  it("falls through to getStatusColor when flagged is undefined", () => {
    const result = resolveDisplayColor("In Progress", undefined);
    expect(result.hex).toBe("#3b82f6");
  });

  it("returns NO_TASK_COLOR when status is undefined and not flagged", () => {
    const result = resolveDisplayColor(undefined, false);
    expect(result.hex).toBe("#b21c8e");
  });
});
