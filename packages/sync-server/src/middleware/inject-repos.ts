import { createMiddleware } from "hono/factory";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema.js";
import { D1SyncRepository } from "../repositories/d1.repo.js";
import { D1JiraAccountRepository } from "../repositories/jira-accounts.repo.js";
import { D1WorkspaceRepository } from "../repositories/workspaces.repo.js";
import { R2ScreenshotStore } from "../repositories/r2.store.js";
import { TicketLockService } from "../services/ticket-lock.service.js";
import { CredentialVault } from "../services/credential-vault.js";
import {
  JiraClientFactory,
  type CreateJiraService,
} from "../services/jira-client-factory.js";
import { JiraTicketService } from "../services/jira-ticket.service.js";
import { JiraAccountService } from "../services/jira-account.service.js";
import { WorkspaceService } from "../services/workspace.service.js";
import { JiraService } from "../services/jira.service.js";
import { parseCredentialEnv } from "../schemas/env.js";
import type { AppEnv } from "../types.js";

const createJiraService: CreateJiraService = (config) =>
  new JiraService(config);

export const injectRepos = createMiddleware<AppEnv>(async (c, next) => {
  const db = drizzle(c.env.DB, { schema });
  const repo = new D1SyncRepository(db);
  const screenshots = new R2ScreenshotStore(c.env.BUCKET);
  c.set("repo", repo);
  c.set("ticketLock", new TicketLockService(repo));
  c.set("screenshots", screenshots);

  // Composition root for Jira (ADR-0027). Nothing here reads a credential:
  // the vault is built, and the key ring validated, only when a request
  // opens an account.
  const accounts = new D1JiraAccountRepository(db);
  const workspaces = new D1WorkspaceRepository(db);
  let vault: CredentialVault | undefined;
  const getVault = () =>
    (vault ??= new CredentialVault(parseCredentialEnv(c.env)));
  const clients = new JiraClientFactory({
    accounts,
    workspaces,
    vault: getVault,
    createJiraService,
  });
  c.set("jiraClients", clients);
  c.set("jiraTickets", new JiraTicketService({ repo, screenshots, clients }));
  c.set(
    "jiraAccounts",
    new JiraAccountService({
      accounts,
      workspaces,
      vault: getVault,
      clients,
      createJiraService,
    }),
  );
  c.set("workspaces", new WorkspaceService({ workspaces, accounts, clients }));
  await next();
});
