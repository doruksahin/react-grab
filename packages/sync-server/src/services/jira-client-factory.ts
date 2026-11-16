import type {
  JiraAccount,
  JiraAccountRepository,
  TicketOrigin,
  WorkspaceRepository,
} from "../repositories/types.js";
import type { CredentialVault } from "./credential-vault.js";
import { JiraError } from "./jira-errors.js";
import type { JiraConfig, JiraService } from "./jira.service.js";

export type CreateJiraService = (config: JiraConfig) => JiraService;

/** A Jira client and the account it signs in as. */
export interface JiraAccountClient {
  jira: JiraService;
  /** null for the environment account (ADR-0018), until the cut-over. */
  accountId: string | null;
  siteUrl: string;
  /** null when not known without asking Jira: the environment account. */
  signsInAs: string | null;
}

/** Where a workspace's new tickets go: an account and one of its projects. */
export interface ResolvedDestination extends JiraAccountClient {
  projectKey: string;
}

export interface JiraClientFactoryDeps {
  accounts: JiraAccountRepository;
  workspaces: WorkspaceRepository;
  /** Built on first use, so a request that needs no account decrypts nothing. */
  vault: () => CredentialVault;
  /** The environment account, or null when it is not configured. */
  environment: () => JiraConfig | null;
  createJiraService: CreateJiraService;
}

/**
 * Builds a JiraService for the right account (ADR-0027): a workspace's
 * destination for new tickets and pickers, a ticket's origin for reading and
 * commenting on it. The one place that decides which account a request uses.
 */
export class JiraClientFactory {
  constructor(private readonly deps: JiraClientFactoryDeps) {}

  /** A client for a stored account; decrypts its credential for this request only. */
  async forAccount(account: JiraAccount): Promise<JiraAccountClient> {
    const credential = await this.deps
      .vault()
      .open(account.id, account.credential);
    return {
      jira: this.deps.createJiraService({
        baseUrl: account.siteUrl,
        email: account.email,
        apiToken: credential.token,
      }),
      accountId: account.id,
      siteUrl: account.siteUrl,
      signsInAs: account.displayName,
    };
  }

  async forAccountId(accountId: string): Promise<JiraAccountClient> {
    const account = await this.deps.accounts.find(accountId);
    if (!account) {
      throw new JiraError(
        "jira-account-not-found",
        `No Jira account with id "${accountId}"`,
      );
    }
    return this.forAccount(account);
  }

  /**
   * The workspace's destination. Until the cut-over, a workspace without one
   * uses the environment account and the client's project key.
   */
  async forWorkspace(
    workspaceId: string,
    legacyProjectKey?: string,
  ): Promise<ResolvedDestination> {
    const workspace = await this.deps.workspaces.find(workspaceId);
    if (workspace?.jiraAccountId && workspace.jiraProjectKey) {
      const client = await this.forAccountId(workspace.jiraAccountId);
      return { ...client, projectKey: workspace.jiraProjectKey };
    }
    const environment = this.forEnvironment();
    if (environment && legacyProjectKey) {
      return { ...environment, projectKey: legacyProjectKey };
    }
    throw new JiraError(
      "jira-destination-missing",
      `Workspace "${workspaceId}" has no Jira destination. Choose one in the extension's settings.`,
    );
  }

  /** The account that created the ticket; a ticket without an origin predates ADR-0027. */
  async forTicket(origin: TicketOrigin): Promise<JiraAccountClient> {
    if (origin.jiraAccountId) return this.forAccountId(origin.jiraAccountId);
    const environment = this.forEnvironment();
    if (environment) return environment;
    throw new JiraError(
      "jira-account-not-found",
      `Ticket ${origin.jiraTicketId} has no Jira account to read it with`,
    );
  }

  /** The environment account (ADR-0018), or null once it is removed. */
  forEnvironment(): JiraAccountClient | null {
    const config = this.deps.environment();
    if (!config) return null;
    return {
      jira: this.deps.createJiraService(config),
      accountId: null,
      siteUrl: config.baseUrl,
      signsInAs: null,
    };
  }
}
