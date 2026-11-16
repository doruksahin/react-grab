import { env } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema.js";
import { D1SyncRepository } from "../repositories/d1.repo.js";
import { D1JiraAccountRepository } from "../repositories/jira-accounts.repo.js";
import { D1WorkspaceRepository } from "../repositories/workspaces.repo.js";
import type { ScreenshotStore } from "../repositories/types.js";
import { type CredentialEnv, parseCredentialEnv } from "../schemas/env.js";
import { CredentialVault } from "../services/credential-vault.js";
import { JiraClientFactory } from "../services/jira-client-factory.js";
import { JiraAccountService } from "../services/jira-account.service.js";
import { JiraTicketService } from "../services/jira-ticket.service.js";
import { WorkspaceService } from "../services/workspace.service.js";
import { JiraService, type JiraConfig } from "../services/jira.service.js";

const noScreenshots: ScreenshotStore = {
  upload: async () => {},
  get: async () => null,
};

/**
 * The ADR-0027 services over real D1, with the JiraService constructor
 * recorded so a test can see which account each call used. Tests stub the
 * JiraService methods they need (vi.spyOn on its prototype); nothing reaches
 * Jira.
 */
export const createJiraAccountsHarness = (
  environment: JiraConfig | null = null,
  keyRing: CredentialEnv = parseCredentialEnv(env),
) => {
  const db = drizzle(env.DB, { schema });
  const repo = new D1SyncRepository(db);
  const accounts = new D1JiraAccountRepository(db);
  const workspaces = new D1WorkspaceRepository(db);
  const vault = new CredentialVault(keyRing);
  const createdWith: JiraConfig[] = [];
  const configs = new WeakMap<JiraService, JiraConfig>();
  const createJiraService = (config: JiraConfig) => {
    createdWith.push(config);
    const service = new JiraService(config);
    configs.set(service, config);
    return service;
  };
  /** The account a stubbed JiraService method was called on. */
  const configOf = (service: JiraService): JiraConfig => {
    const config = configs.get(service);
    if (!config) throw new Error("JiraService not built by this harness");
    return config;
  };
  const clients = new JiraClientFactory({
    accounts,
    workspaces,
    vault: () => vault,
    environment: () => environment,
    createJiraService,
  });
  return {
    repo,
    accounts,
    workspaces,
    vault,
    createdWith,
    configOf,
    clients,
    accountService: new JiraAccountService({
      accounts,
      workspaces,
      vault: () => vault,
      clients,
      createJiraService,
    }),
    workspaceService: new WorkspaceService({ workspaces, accounts, clients }),
    ticketService: new JiraTicketService({
      repo,
      screenshots: noScreenshots,
      clients,
    }),
  };
};
