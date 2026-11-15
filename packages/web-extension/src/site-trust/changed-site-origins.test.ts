import { describe, expect, it } from "vitest";
import { changedSiteOrigins } from "./changed-site-origins.js";

const SITE = { workspace: "app", jiraProjectKey: "ATT" };

describe("changedSiteOrigins", () => {
  it("lists removed sites and sites whose workspace or Jira project changed", () => {
    expect(
      changedSiteOrigins(
        {
          "https://kept.test": SITE,
          "https://removed.test": SITE,
          "https://new-workspace.test": SITE,
          "https://new-project.test": SITE,
        },
        {
          "https://kept.test": SITE,
          "https://new-workspace.test": { ...SITE, workspace: "other" },
          "https://new-project.test": { ...SITE, jiraProjectKey: "OTH" },
          "https://added.test": SITE,
        },
      ),
    ).toEqual({
      removed: ["https://removed.test"],
      reconfigured: ["https://new-workspace.test", "https://new-project.test"],
    });
  });
});
