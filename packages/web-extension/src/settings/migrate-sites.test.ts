import { describe, expect, it } from "vitest";
import { addRecordingSettings } from "./migrate-sites.js";

describe("addRecordingSettings", () => {
  it("turns step capture and session recording off for existing sites", () => {
    expect(
      addRecordingSettings({
        "https://app.example.test": { workspace: "app", jiraProjectKey: "ATT" },
      }),
    ).toEqual({
      "https://app.example.test": {
        workspace: "app",
        jiraProjectKey: "ATT",
        recordSteps: false,
        recordSession: false,
      },
    });
  });

  it("keeps an empty site list empty", () => {
    expect(addRecordingSettings({})).toEqual({});
  });

  it("keeps settings that are already there", () => {
    const sites = {
      "https://app.example.test": {
        workspace: "app",
        jiraProjectKey: "ATT",
        recordSteps: true,
        recordSession: true,
      },
    };
    expect(addRecordingSettings(sites)).toEqual(sites);
  });
});
