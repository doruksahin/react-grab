import { type JiraMe, getJiraMe } from "../generated/sync-api.js";
import { createSyncRequest, successData } from "./request.js";
import type { SyncHttpConfig } from "./types.js";

export type { JiraMe };

/** Who the connection's Jira credential signs in as on the workspace's site (ADR-0031). */
export const fetchJiraMe = async (config: SyncHttpConfig): Promise<JiraMe> =>
  successData(
    "GET /workspaces/{id}/jira/me",
    await getJiraMe(config.workspace, createSyncRequest(config).options()),
  );

/** `base64(email:apiToken)`, the value of the `X-Jira-Credential` header. */
export const encodeJiraCredential = (email: string, apiToken: string): string =>
  btoa(`${email.trim()}:${apiToken.trim()}`);
