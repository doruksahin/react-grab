import { z } from "zod";

/**
 * Worker configuration.
 *
 * The other schemas in this folder describe requests and responses; this one
 * describes the environment the Worker runs in. It is a plain Zod schema
 * rather than an env library because the Worker is the only package in this
 * repo that reads environment variables at all — see ADR-0018.
 *
 * Where the values come from:
 *   JIRA_BASE_URL  — `[vars]` in wrangler.toml (not secret, committed)
 *   JIRA_EMAIL     — `[vars]` per environment (not secret, committed)
 *   JIRA_API_TOKEN — `wrangler secret put JIRA_API_TOKEN` in production,
 *                    `.dev.vars` locally (secret, never committed)
 *
 * Tickets are created as the Jira user that JIRA_EMAIL identifies, on the
 * site that JIRA_BASE_URL points at. Changing either changes where every
 * ticket lands, so both are validated rather than trusted.
 */
export const JiraEnvSchema = z.object({
  JIRA_BASE_URL: z
    .string()
    .min(1, "is empty — set the Jira site, e.g. https://acme.atlassian.net")
    .url("must be a full URL, e.g. https://acme.atlassian.net"),
  JIRA_EMAIL: z
    .string()
    .min(1, "is empty — set the Jira account that tickets are created as")
    .email("must be an email address, e.g. bot@acme.com"),
  JIRA_API_TOKEN: z
    .string()
    .min(
      1,
      "is empty — run `wrangler secret put JIRA_API_TOKEN`, or add it to .dev.vars for local dev",
    ),
});

export type JiraEnv = z.infer<typeof JiraEnvSchema>;

/**
 * Validates the Jira configuration, naming every problem at once.
 *
 * Called per request from the composition root rather than cached at module
 * scope: Cloudflare may reuse an isolate when only bindings change, so a
 * cached value can outlive a rotated secret.
 */
export const parseJiraEnv = (env: unknown): JiraEnv => {
  const result = JiraEnvSchema.safeParse(env);
  if (result.success) return result.data;

  const problems = result.error.issues
    .map((issue) => `  ${issue.path.join(".")} ${issue.message}`)
    .join("\n");
  throw new Error(
    `Jira is not configured correctly:\n${problems}\n` +
      "See packages/sync-server/.dev.vars.example and ADR-0018.",
  );
};

/**
 * Access-control configuration (ADR-0020).
 *
 *   SYNC_API_TOKEN  — the bearer token every API request must carry.
 *                     Secret: `wrangler secret put` in production,
 *                     `.dev.vars` locally. At least 32 characters so it
 *                     cannot be guessed.
 *   ALLOWED_ORIGINS — optional, comma-separated origins allowed to call the
 *                     API from a browser, on top of local dev servers.
 *                     Not secret: `[vars]` in wrangler.toml.
 */
export const AuthEnvSchema = z.object({
  SYNC_API_TOKEN: z
    .string()
    .min(
      32,
      "is missing or shorter than 32 characters — run `wrangler secret put SYNC_API_TOKEN` with a random value, or add it to .dev.vars for local dev",
    ),
  ALLOWED_ORIGINS: z.string().optional(),
});

export type AuthEnv = z.infer<typeof AuthEnvSchema>;

/** Validates the access-control configuration. Fails closed: no token, no API. */
export const parseAuthEnv = (env: unknown): AuthEnv => {
  const result = AuthEnvSchema.safeParse(env);
  if (result.success) return result.data;

  const problems = result.error.issues
    .map((issue) => `  ${issue.path.join(".")} ${issue.message}`)
    .join("\n");
  throw new Error(
    `Access control is not configured correctly:\n${problems}\n` +
      "See packages/sync-server/.dev.vars.example and ADR-0020.",
  );
};
