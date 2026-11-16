/**
 * The host name of the Jira site (e.g. "acme.atlassian.net") from the site
 * URL of the workspace's destination (GET /workspaces/{id}/jira). Null when it is missing or
 * not a URL.
 */
export const getSiteHost = (
  siteUrl: string | null | undefined,
): string | null => {
  if (!siteUrl) return null;
  try {
    return new URL(siteUrl).host;
  } catch {
    return null;
  }
};
