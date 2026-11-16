import type { z } from "@hono/zod-openapi";
import type {
  JiraAccount,
  JiraAccountRepository,
  WorkspaceRepository,
} from "../repositories/types.js";
import type {
  AddJiraAccountRequest,
  JiraAccountSummary,
  JiraProject,
} from "../schemas/index.js";
import type { CredentialVault } from "./credential-vault.js";
import type {
  CreateJiraService,
  JiraClientFactory,
} from "./jira-client-factory.js";
import { JiraError, toJiraError, withJiraErrors } from "./jira-errors.js";
import type { JiraMyself } from "./jira.service.js";

type AddJiraAccountInput = z.infer<typeof AddJiraAccountRequest>;
type JiraAccountSummaryValue = z.infer<typeof JiraAccountSummary>;
type JiraProjectValue = z.infer<typeof JiraProject>;

export interface JiraAccountServiceDeps {
  accounts: JiraAccountRepository;
  workspaces: WorkspaceRepository;
  vault: () => CredentialVault;
  clients: JiraClientFactory;
  createJiraService: CreateJiraService;
}

/**
 * Adds, verifies, re-keys and removes Jira accounts (ADR-0027). An account is
 * saved only after Jira has accepted its credential, and the credential never
 * leaves this service in the clear.
 */
export class JiraAccountService {
  constructor(private readonly deps: JiraAccountServiceDeps) {}

  async list(): Promise<JiraAccountSummaryValue[]> {
    const [accounts, workspaces] = await Promise.all([
      this.deps.accounts.list(),
      this.deps.workspaces.list(),
    ]);
    const usage = new Map<string, number>();
    for (const workspace of workspaces) {
      if (!workspace.jiraAccountId) continue;
      usage.set(
        workspace.jiraAccountId,
        (usage.get(workspace.jiraAccountId) ?? 0) + 1,
      );
    }
    return accounts.map((account) => toSummary(account, usage.get(account.id)));
  }

  async add(input: AddJiraAccountInput): Promise<JiraAccountSummaryValue> {
    const myself = await this.verify(
      input.siteUrl,
      input.email,
      input.apiToken,
    );
    const id = crypto.randomUUID();
    const account: JiraAccount = {
      id,
      siteUrl: input.siteUrl,
      email: input.email,
      atlassianAccountId: myself.accountId,
      displayName: myself.displayName,
      credential: await this.deps
        .vault()
        .seal(id, { kind: "api-token", token: input.apiToken }),
      createdAt: Date.now(),
    };
    if ((await this.deps.accounts.insert(account)) === "duplicate") {
      throw new JiraError(
        "jira-account-duplicate",
        `${myself.displayName} on ${input.siteUrl} is already added. Replace its token instead.`,
      );
    }
    return toSummary(account, 0);
  }

  /** Replaces the token, after Jira confirms it belongs to the same user. */
  async replaceCredential(
    accountId: string,
    apiToken: string,
  ): Promise<JiraAccountSummaryValue> {
    const account = await this.deps.accounts.find(accountId);
    if (!account) {
      throw new JiraError(
        "jira-account-not-found",
        `No Jira account with id "${accountId}"`,
      );
    }
    const myself = await this.verify(account.siteUrl, account.email, apiToken);
    if (myself.accountId !== account.atlassianAccountId) {
      throw new JiraError(
        "jira-account-mismatch",
        `This token signs in as ${myself.displayName}, not ${account.displayName}. Add it as a new account instead.`,
      );
    }
    const credential = await this.deps
      .vault()
      .seal(account.id, { kind: "api-token", token: apiToken });
    await this.deps.accounts.updateCredential(account.id, credential);
    const summaries = await this.list();
    return (
      summaries.find((summary) => summary.id === account.id) ??
      toSummary({ ...account, credential }, 0)
    );
  }

  /** Removes an account no workspace or ticket refers to. Absent counts as removed. */
  async remove(accountId: string): Promise<void> {
    if ((await this.deps.accounts.delete(accountId)) === "in-use") {
      throw new JiraError(
        "jira-account-in-use",
        "A workspace or a ticket still uses this Jira account",
      );
    }
  }

  /**
   * Seals every credential that an older key version sealed with the current
   * one. Step two of a key rotation: after it, the old version can leave the
   * key ring (ADR-0027).
   */
  async reencryptAll(): Promise<{ reencrypted: number }> {
    const vault = this.deps.vault();
    let reencrypted = 0;
    for (const account of await this.deps.accounts.list()) {
      if (account.credential.keyVersion === vault.currentKeyVersion) continue;
      const credential = await vault.open(account.id, account.credential);
      await this.deps.accounts.updateCredential(
        account.id,
        await vault.seal(account.id, credential),
      );
      reencrypted += 1;
    }
    return { reencrypted };
  }

  async listProjects(accountId: string): Promise<JiraProjectValue[]> {
    const { jira } = await this.deps.clients.forAccountId(accountId);
    return withJiraErrors(
      () => jira.getProjects(),
      "Failed to list Jira projects",
    );
  }

  private async verify(
    siteUrl: string,
    email: string,
    apiToken: string,
  ): Promise<JiraMyself> {
    try {
      return await this.deps
        .createJiraService({ baseUrl: siteUrl, email, apiToken })
        .getMyself();
    } catch (error) {
      const jiraError = toJiraError(error, "Could not reach Jira");
      if (jiraError.code === "jira-account-rejected") {
        throw new JiraError(
          "jira-credential-invalid",
          "Jira did not accept this email and API token",
          { cause: error },
        );
      }
      throw jiraError;
    }
  }
}

const toSummary = (
  account: JiraAccount,
  workspaceCount = 0,
): JiraAccountSummaryValue => ({
  id: account.id,
  siteUrl: account.siteUrl,
  email: account.email,
  displayName: account.displayName,
  workspaceCount,
});
