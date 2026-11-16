import { JiraErrorResponse } from "../schemas/index.js";

const jiraError = (description: string) => ({
  description,
  content: { "application/json": { schema: JiraErrorResponse } },
});

/**
 * The failures every Jira route can answer with, for the OpenAPI document.
 * The app's error handler sends them (`JiraError`, ADR-0027).
 */
export const jiraErrorResponses = {
  404: jiraError("Account or ticket not found"),
  409: jiraError("No destination, duplicate account, or account in use"),
  422: jiraError("Jira did not accept the credential, or no such project"),
  502: jiraError("Jira rejected the account or the request"),
} as const;
