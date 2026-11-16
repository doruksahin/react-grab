import type { z } from "@hono/zod-openapi";
import type {
  JiraAccountRepository,
  WorkspaceRepository,
} from "../repositories/types.js";
import type { JiraDestination, WorkspaceSummary } from "../schemas/index.js";
import type { JiraClientFactory } from "./jira-client-factory.js";
import { JiraError, withJiraErrors } from "./jira-errors.js";

type JiraDestinationValue = z.infer<typeof JiraDestination>;
type WorkspaceSummaryValue = z.infer<typeof WorkspaceSummary>;

export interface WorkspaceServiceDeps {
  workspaces: WorkspaceRepository;
  accounts: JiraAccountRepository;
  clients: JiraClientFactory;
}

/**
 * Workspaces and where their new Jira tickets go (ADR-0027). Changing a
 * destination changes only new tickets: each ticket keeps the account that
 * created it.
 */
export class WorkspaceService {
  constructor(private readonly deps: WorkspaceServiceDeps) {}

  async list(): Promise<WorkspaceSummaryValue[]> {
    const [workspaces, accounts] = await Promise.all([
      this.deps.workspaces.list(),
      this.deps.accounts.list(),
    ]);
    const siteByAccount = new Map(
      accounts.map((account) => [account.id, account.siteUrl]),
    );
    return workspaces.map((workspace) => ({
      id: workspace.id,
      jiraAccountId: workspace.jiraAccountId,
      jiraProjectKey: workspace.jiraProjectKey,
      siteUrl: workspace.jiraAccountId
        ? (siteByAccount.get(workspace.jiraAccountId) ?? null)
        : null,
    }));
  }

  ensure(workspaceId: string): Promise<void> {
    return this.deps.workspaces.ensure(workspaceId);
  }

  /** Points the workspace's new tickets at a project the account can see. */
  async setDestination(
    workspaceId: string,
    jiraAccountId: string,
    projectKey: string,
  ): Promise<JiraDestinationValue> {
    const client = await this.deps.clients.forAccountId(jiraAccountId);
    const exists = await withJiraErrors(
      () => client.jira.hasProject(projectKey),
      "Failed to check the Jira project",
    );
    if (!exists) {
      throw new JiraError(
        "jira-project-not-found",
        `${client.signsInAs ?? "This account"} has no project ${projectKey} on ${client.siteUrl}`,
      );
    }
    await this.deps.workspaces.setDestination(
      workspaceId,
      jiraAccountId,
      projectKey,
    );
    return {
      siteUrl: client.siteUrl,
      projectKey,
      signsInAs: client.signsInAs,
    };
  }

  clearDestination(workspaceId: string): Promise<void> {
    return this.deps.workspaces.clearDestination(workspaceId);
  }

  async getDestination(
    workspaceId: string,
    legacyProjectKey?: string,
  ): Promise<JiraDestinationValue> {
    const destination = await this.deps.clients.forWorkspace(
      workspaceId,
      legacyProjectKey,
    );
    return {
      siteUrl: destination.siteUrl,
      projectKey: destination.projectKey,
      signsInAs: destination.signsInAs,
    };
  }
}
