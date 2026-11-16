import { JiraErrorResponseCode } from "../../../generated/sync-api.js";
import type { JiraErrorCode } from "../../sync/types.js";
import { describeCreateFailure } from "./describe-create-failure.js";

/** Why the create dialog cannot create a ticket, and what to do about it. */
export interface DestinationProblem {
  code: JiraErrorCode | null;
  title: string;
  detail: string;
}

const SETTINGS_HINT = "Open the React Grab extension's settings.";

const PROBLEMS: Partial<
  Record<JiraErrorCode, Omit<DestinationProblem, "code">>
> = {
  "jira-account-rejected": {
    title: "Jira rejected the account",
    detail: `Replace its API token. ${SETTINGS_HINT}`,
  },
  "jira-destination-missing": {
    title: "This workspace has no Jira destination",
    detail: `Choose its Jira account and project. ${SETTINGS_HINT}`,
  },
  "jira-project-forbidden": {
    title: "The account has no access to the project",
    detail: `Choose another project, or another account. ${SETTINGS_HINT}`,
  },
  "jira-account-not-found": {
    title: "The workspace's Jira account was removed",
    detail: `Choose another account. ${SETTINGS_HINT}`,
  },
};

const isJiraErrorCode = (value: string): value is JiraErrorCode =>
  Object.hasOwn(JiraErrorResponseCode, value);

/**
 * The server names a Jira failure with a code (ADR-0027). The code is an own
 * property of the error, so it is read by shape: the extension's message
 * channels keep the property but not the class.
 */
export const jiraErrorCodeOf = (error: unknown): JiraErrorCode | null => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }
  const { code } = error;
  return typeof code === "string" && isJiraErrorCode(code) ? code : null;
};

export const describeDestinationProblem = (
  error: unknown,
): DestinationProblem => {
  const code = jiraErrorCodeOf(error);
  const known = code ? PROBLEMS[code] : undefined;
  if (known) return { code, ...known };
  return {
    code,
    title: "Could not load the Jira destination",
    detail: describeCreateFailure(error),
  };
};
