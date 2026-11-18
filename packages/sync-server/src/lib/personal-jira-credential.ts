/**
 * A Jira user's own email and API token, sent by the browser extension with a
 * request so the server acts in Jira as that person (ADR-0031). It is used for
 * that one request and never stored or logged.
 */
export interface PersonalJiraCredential {
  email: string;
  apiToken: string;
}

export const JIRA_CREDENTIAL_HEADER = "X-Jira-Credential";

const CREDENTIAL_SEPARATOR = ":";

/** Reads `base64(email:apiToken)`; undefined when the header is absent or malformed. */
export const parsePersonalJiraCredential = (
  headerValue: string | undefined,
): PersonalJiraCredential | undefined => {
  if (!headerValue) return undefined;
  let decoded: string;
  try {
    decoded = atob(headerValue);
  } catch {
    return undefined;
  }
  const separatorIndex = decoded.indexOf(CREDENTIAL_SEPARATOR);
  if (separatorIndex <= 0) return undefined;
  const email = decoded.slice(0, separatorIndex).trim();
  const apiToken = decoded.slice(separatorIndex + 1).trim();
  if (!email || !apiToken) return undefined;
  return { email, apiToken };
};
