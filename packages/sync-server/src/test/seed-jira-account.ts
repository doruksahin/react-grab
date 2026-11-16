import { env } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema.js";
import { D1JiraAccountRepository } from "../repositories/jira-accounts.repo.js";

/**
 * Stores a Jira account row so a test can link a ticket to it: D1 enforces
 * `groups.jira_account_id` as a foreign key. The credential is not a real
 * ciphertext; use createJiraAccountsHarness when a test opens the account.
 */
export const seedJiraAccount = async (id: string): Promise<string> => {
  const accounts = new D1JiraAccountRepository(drizzle(env.DB, { schema }));
  await accounts.insert({
    id,
    siteUrl: "https://seed.atlassian.net",
    email: `${id}@seed.test`,
    atlassianAccountId: id,
    displayName: id,
    credential: {
      kind: "api-token",
      ciphertext: "unused",
      iv: "unused",
      keyVersion: "v1",
    },
    createdAt: Date.now(),
  });
  return id;
};
