import { describe, expect, it } from "vitest";
import { changedSiteOrigins } from "./changed-site-origins.js";

const SITE = {
  workspace: "app",
  jiraProjectKey: "ATT",
  recordSteps: false,
  recordSession: false,
};

describe("changedSiteOrigins", () => {
  it("lists removed sites and sites with any changed setting", () => {
    expect(
      changedSiteOrigins(
        {
          "https://kept.test": SITE,
          "https://removed.test": SITE,
          "https://new-workspace.test": SITE,
          "https://new-project.test": SITE,
          "https://steps-on.test": SITE,
          "https://session-on.test": SITE,
        },
        {
          "https://kept.test": SITE,
          "https://new-workspace.test": { ...SITE, workspace: "other" },
          "https://new-project.test": { ...SITE, jiraProjectKey: "OTH" },
          "https://steps-on.test": { ...SITE, recordSteps: true },
          "https://session-on.test": { ...SITE, recordSession: true },
          "https://added.test": SITE,
        },
      ),
    ).toEqual({
      removed: ["https://removed.test"],
      reconfigured: [
        "https://new-workspace.test",
        "https://new-project.test",
        "https://steps-on.test",
        "https://session-on.test",
      ],
    });
  });

  it("reloads nothing when the storage migration only adds the defaults", () => {
    const { workspace, jiraProjectKey } = SITE;
    expect(
      changedSiteOrigins(
        { "https://kept.test": { workspace, jiraProjectKey } },
        { "https://kept.test": SITE },
      ),
    ).toEqual({ removed: [], reconfigured: [] });
  });
});
