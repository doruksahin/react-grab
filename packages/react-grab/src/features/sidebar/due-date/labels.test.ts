import { describe, expect, it } from "vitest";
import {
  DUE_DATE_PRESET_LABEL,
  DUE_DATE_PRESET_LABEL_ALL,
  dueDatePresetLabel,
} from "./labels.js";
import { DUE_DATE_PRESET_ORDER } from "./presets.js";

describe("DUE_DATE_PRESET_LABEL", () => {
  it("provides a non-empty label for every preset key", () => {
    for (const key of DUE_DATE_PRESET_ORDER) {
      expect(DUE_DATE_PRESET_LABEL[key]).toBeTruthy();
      expect(DUE_DATE_PRESET_LABEL[key].length).toBeGreaterThan(0);
    }
  });
});

describe("DUE_DATE_PRESET_LABEL_ALL", () => {
  it("is the inactive placeholder text", () => {
    expect(DUE_DATE_PRESET_LABEL_ALL).toBe("All due dates");
  });
});

describe("dueDatePresetLabel", () => {
  it("resolves the empty string to the 'All' placeholder", () => {
    expect(dueDatePresetLabel("")).toBe(DUE_DATE_PRESET_LABEL_ALL);
  });

  it("resolves a known preset key to its label", () => {
    expect(dueDatePresetLabel("today")).toBe("Due today");
    expect(dueDatePresetLabel("overdue")).toBe("Overdue");
    expect(dueDatePresetLabel("none")).toBe("No due date");
  });

  it("falls back to the raw value for unknown keys", () => {
    expect(dueDatePresetLabel("garbage")).toBe("garbage");
  });
});
