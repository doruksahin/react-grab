import { describe, expect, it } from "vitest";
import { isSetupDone, setupSteps } from "./setup-steps.js";

const ACCOUNT = {
  id: "acc-1",
  siteUrl: "https://acme.atlassian.net",
  email: "ada@example.com",
  displayName: "Ada",
  workspaceCount: 1,
};

const BOUND_WORKSPACE = {
  id: "storefront",
  jiraAccountId: "acc-1",
  jiraProjectKey: "SHOP",
  siteUrl: "https://acme.atlassian.net",
};

const SITE = {
  "https://app.example.com": {
    workspace: "storefront",
    recordSteps: false,
    recordSession: false,
  },
};

describe("setupSteps", () => {
  it("shows only the server and a site without the admin token", () => {
    const steps = setupSteps({
      isConnected: true,
      accounts: null,
      workspaces: [],
      sites: {},
    });
    expect(steps.map((step) => [step.target, step.done])).toEqual([
      ["sync-server", true],
      ["add-site", false],
    ]);
  });

  it("adds the Jira steps with the admin token, in the order they depend on", () => {
    const steps = setupSteps({
      isConnected: true,
      accounts: [ACCOUNT],
      workspaces: [{ ...BOUND_WORKSPACE, jiraProjectKey: null }],
      sites: {},
    });
    expect(steps.map((step) => [step.title, step.done])).toEqual([
      ["Connect the sync server", true],
      ["Connect a Jira account", true],
      ["Choose where a workspace's tickets go", false],
      ["Enable a site", false],
    ]);
    expect(isSetupDone(steps)).toBe(false);
  });

  it("is done when every step is", () => {
    expect(
      isSetupDone(
        setupSteps({
          isConnected: true,
          accounts: [ACCOUNT],
          workspaces: [BOUND_WORKSPACE],
          sites: SITE,
        }),
      ),
    ).toBe(true);
  });
});
