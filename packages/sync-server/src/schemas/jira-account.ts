import { z } from "@hono/zod-openapi";

const ATLASSIAN_CLOUD_HOST = /^[a-z0-9][a-z0-9-]*\.atlassian\.net$/;

/**
 * A Jira Cloud site, normalized to its origin (ADR-0027). Only
 * `https://<name>.atlassian.net` is accepted: the Worker sends an account's
 * credential to this origin, so an allow-list keeps a typed URL from sending
 * it anywhere else (OWASP SSRF prevention).
 */
export const JiraSiteUrl = z
  .string()
  .trim()
  .url()
  .transform((value) => new URL(value))
  .refine(
    (url) =>
      url.protocol === "https:" &&
      ATLASSIAN_CLOUD_HOST.test(url.hostname) &&
      url.port === "" &&
      url.username === "" &&
      url.password === "",
    "must be a Jira Cloud site, e.g. https://acme.atlassian.net",
  )
  .transform((url) => url.origin)
  .openapi({ type: "string", example: "https://acme.atlassian.net" });

export const JiraAccountIdParam = z.object({
  accountId: z.string().openapi({ description: "Jira account ID" }),
});

export const JiraAccountSummary = z
  .object({
    id: z.string(),
    siteUrl: z.string().openapi({ example: "https://acme.atlassian.net" }),
    email: z.string().openapi({ example: "dev@acme.com" }),
    displayName: z.string().openapi({ example: "Ada Lovelace" }),
    workspaceCount: z.number().int(),
  })
  .openapi("JiraAccountSummary");

export const AddJiraAccountRequest = z.object({
  siteUrl: JiraSiteUrl,
  email: z.string().trim().email(),
  apiToken: z.string().min(1),
});

export const ReplaceJiraCredentialRequest = z.object({
  apiToken: z.string().min(1),
});

/**
 * Why a Jira request failed, for the client to show (ADR-0027). One list,
 * mapped in one place (`services/jira-errors.ts`).
 */
export const JiraErrorCode = z.enum([
  "jira-account-rejected",
  "jira-credential-invalid",
  "jira-project-forbidden",
  "jira-ticket-missing",
  "jira-destination-missing",
  "jira-account-duplicate",
  "jira-account-in-use",
  "jira-account-not-found",
  "jira-account-mismatch",
  "jira-project-not-found",
  "jira-request-failed",
]);

export const JiraErrorResponse = z
  .object({
    error: z.string(),
    code: JiraErrorCode,
  })
  .openapi("JiraErrorResponse");
