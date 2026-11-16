/** "acme.atlassian.net" from "https://acme.atlassian.net"; the input when it is not a URL. */
export const siteHost = (siteUrl: string): string =>
  URL.canParse(siteUrl) ? new URL(siteUrl).host : siteUrl;
