import { describe, expect, it } from "vitest";
import { captureOptions } from "./capture-options.js";

const SITE = {
  workspace: "app",
  jiraProjectKey: "ATT",
  recordSteps: true,
  recordSession: false,
};

describe("captureOptions", () => {
  it("follows the site's settings", () => {
    expect(captureOptions(SITE)).toEqual({
      steps: { enabled: true },
      recording: { enabled: false },
    });
  });

  it("records nothing on a site that is not enabled", () => {
    expect(captureOptions(null)).toEqual({
      steps: { enabled: false },
      recording: { enabled: false },
    });
  });
});
