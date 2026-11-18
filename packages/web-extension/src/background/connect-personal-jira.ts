import {
  type JiraMe,
  type SyncHttpConfig,
  encodeJiraCredential,
  fetchJiraMe,
} from "react-grab/sync-http";
import { GatewayRefusalError } from "../gateway/sender-policy.js";
import { personalJiraCredentialSchema } from "../settings/settings-schema.js";
import {
  personalJiraAccountItem,
  readSyncSettings,
} from "../settings/settings-items.js";
import type { JiraUserIdentity } from "../settings/types.js";

export type VerifyJiraUser = (config: SyncHttpConfig) => Promise<JiraMe>;

/**
 * Checks who a pasted Jira token signs in as, on the Jira site of the first
 * enabled site's workspace, and keeps it with that answer (ADR-0031).
 */
export const connectPersonalJira = async (
  input: unknown,
  verify: VerifyJiraUser = fetchJiraMe,
): Promise<JiraUserIdentity> => {
  const credential = personalJiraCredentialSchema.parse(input);
  const { serverUrl, apiToken, sites } = await readSyncSettings();
  if (!serverUrl || !apiToken) {
    throw new GatewayRefusalError("the sync server is not configured");
  }
  const workspace = Object.values(sites)[0]?.workspace;
  if (!workspace) {
    throw new GatewayRefusalError(
      "enable a site first: its workspace names the Jira site to sign in to",
    );
  }
  const jiraUser = await verify({
    serverUrl,
    apiToken,
    workspace,
    jiraCredential: encodeJiraCredential(credential.email, credential.apiToken),
  });
  const identity: JiraUserIdentity = {
    accountId: jiraUser.accountId,
    displayName: jiraUser.displayName,
  };
  await personalJiraAccountItem.setValue({ ...credential, ...identity });
  return identity;
};

export const disconnectPersonalJira = (): Promise<void> =>
  personalJiraAccountItem.removeValue();
