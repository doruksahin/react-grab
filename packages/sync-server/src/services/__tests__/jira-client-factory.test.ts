import { describe, expect, it, vi } from "vitest";
import type {
  JiraAccount,
  JiraAccountRepository,
  WorkspaceRepository,
} from "../../repositories/types.js";
import type { CredentialVault } from "../credential-vault.js";
import { JiraClientFactory } from "../jira-client-factory.js";
import type { JiraConfig, JiraService } from "../jira.service.js";

const ACCOUNT: JiraAccount = {
  id: "account-1",
  siteUrl: "https://acme.atlassian.net",
  email: "shared@acme.com",
  atlassianAccountId: "atlassian-shared",
  displayName: "Shared Account",
  credential: {
    kind: "api-token",
    keyVersion: "1",
    iv: "iv",
    ciphertext: "sealed",
  },
  createdAt: 0,
};

const accounts = {
  find: async (id: string) => (id === ACCOUNT.id ? ACCOUNT : undefined),
} as unknown as JiraAccountRepository;

const workspaces = {
  find: async () => ({
    id: "workspace-1",
    jiraAccountId: ACCOUNT.id,
    jiraProjectKey: "SCRUM",
  }),
} as unknown as WorkspaceRepository;

const createFactory = (personal?: { email: string; apiToken: string }) => {
  const configs: JiraConfig[] = [];
  const openCredential = vi.fn(async () => ({ token: "shared-token" }));
  const factory = new JiraClientFactory({
    accounts,
    workspaces,
    vault: () => ({ open: openCredential }) as unknown as CredentialVault,
    createJiraService: (config) => {
      configs.push(config);
      return {} as JiraService;
    },
    personalCredential: personal,
  });
  return { factory, configs, openCredential };
};

describe("JiraClientFactory (ADR-0031)", () => {
  it("signs in to the workspace's site with the caller's personal credential", async () => {
    const { factory, configs, openCredential } = createFactory({
      email: "ayse@acme.com",
      apiToken: "personal-token",
    });

    const destination = await factory.forWorkspace("workspace-1");

    expect(configs).toEqual([
      {
        baseUrl: ACCOUNT.siteUrl,
        email: "ayse@acme.com",
        apiToken: "personal-token",
      },
    ]);
    expect(destination).toMatchObject({
      accountId: ACCOUNT.id,
      projectKey: "SCRUM",
    });
    expect(openCredential).not.toHaveBeenCalled();
  });

  it("uses the stored account's credential without a personal one", async () => {
    const { factory, configs } = createFactory();

    await factory.forWorkspace("workspace-1");

    expect(configs).toEqual([
      {
        baseUrl: ACCOUNT.siteUrl,
        email: ACCOUNT.email,
        apiToken: "shared-token",
      },
    ]);
  });
});
