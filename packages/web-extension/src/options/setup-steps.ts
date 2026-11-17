import type {
  JiraAccountSummary,
  WorkspaceSummary,
} from "react-grab/sync-http";
import type { SiteSettingsByOrigin } from "../settings/types.js";

export interface SetupStep {
  title: string;
  /** The id of the section where the step is done. */
  target: string;
  done: boolean;
}

export interface SetupInput {
  isConnected: boolean;
  /** Null without the admin token: Jira is then set up by someone else. */
  accounts: ReadonlyArray<JiraAccountSummary> | null;
  workspaces: ReadonlyArray<WorkspaceSummary>;
  sites: SiteSettingsByOrigin;
}

/**
 * The first-run steps in the order they depend on each other: the server,
 * then (with the admin token) a Jira account and a workspace that sends
 * tickets to it, then a site.
 */
export const setupSteps = (input: SetupInput): SetupStep[] => {
  const serverStep: SetupStep = {
    title: "Connect the sync server",
    target: "sync-server",
    done: input.isConnected,
  };
  const siteStep: SetupStep = {
    title: "Enable a site",
    target: "add-site",
    done: Object.keys(input.sites).length > 0,
  };
  if (!input.accounts) return [serverStep, siteStep];
  return [
    serverStep,
    {
      title: "Connect a Jira account",
      target: "add-jira-account",
      done: input.accounts.length > 0,
    },
    {
      title: "Choose where a workspace's tickets go",
      target: "add-site",
      done: input.workspaces.some((workspace) =>
        Boolean(workspace.jiraAccountId && workspace.jiraProjectKey),
      ),
    },
    siteStep,
  ];
};

export const isSetupDone = (steps: ReadonlyArray<SetupStep>): boolean =>
  steps.every((step) => step.done);
