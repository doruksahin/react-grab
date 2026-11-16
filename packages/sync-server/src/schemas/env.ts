import { z } from "zod";

/**
 * Worker configuration.
 *
 * The other schemas in this folder describe requests and responses; this one
 * describes the environment the Worker runs in. It is a plain Zod schema
 * rather than an env library because the Worker is the only package in this
 * repo that reads environment variables at all — see ADR-0018.
 *
 * Secrets come from `wrangler secret put <NAME>` in production and
 * `.dev.vars` locally, and are never committed. Jira accounts are not configured
 * here: they are stored in D1 and entered in the extension (ADR-0027).
 */

/**
 * Validates one part of the environment, naming every problem at once.
 *
 * Called per request rather than cached at module scope: Cloudflare may reuse
 * an isolate when only bindings change, so a cached value can outlive a
 * rotated secret.
 */
const parseEnvPart = <Schema extends z.ZodType>(
  schema: Schema,
  env: unknown,
  what: string,
  seeAlso: string,
): z.infer<Schema> => {
  const result = schema.safeParse(env);
  if (result.success) return result.data;

  const problems = result.error.issues
    .map((issue) => `  ${issue.path.join(".")} ${issue.message}`)
    .join("\n");
  throw new Error(
    `${what} is not configured correctly:\n${problems}\n` +
      `See packages/sync-server/.dev.vars.example and ${seeAlso}.`,
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
export const parseAuthEnv = (env: unknown): AuthEnv =>
  parseEnvPart(AuthEnvSchema, env, "Access control", "ADR-0020");

/**
 * The admin token (ADR-0027): needed to add Jira accounts and to choose where
 * a workspace's tickets go. Only the extension's service worker and the
 * dashboard proxy hold it; host apps hold only SYNC_API_TOKEN.
 */
export const AdminEnvSchema = z.object({
  SYNC_ADMIN_TOKEN: z
    .string()
    .min(
      32,
      "is missing or shorter than 32 characters — run `wrangler secret put SYNC_ADMIN_TOKEN` with a random value, or add it to .dev.vars for local dev",
    ),
});

export type AdminEnv = z.infer<typeof AdminEnvSchema>;

/** Validates the admin token. Fails closed: no token, no admin routes. */
export const parseAdminEnv = (env: unknown): AdminEnv =>
  parseEnvPart(AdminEnvSchema, env, "Admin access", "ADR-0027");

const AES_256_KEY_BYTES = 32;

const credentialKey = z
  .string()
  .refine(
    (value) => Buffer.from(value, "base64").byteLength === AES_256_KEY_BYTES,
    "must be 32 random bytes in base64, e.g. `openssl rand -base64 32`",
  );

/**
 * The key ring that encrypts Jira credentials at rest (ADR-0027).
 *
 *   JIRA_CREDENTIAL_KEYS        — secret JSON `{ "<version>": "<base64 key>" }`
 *   JIRA_CREDENTIAL_KEY_CURRENT — the version new writes use; not secret
 *
 * Rotation: add a version, make it current, re-encrypt, remove the old one.
 */
export const CredentialEnvSchema = z
  .object({
    JIRA_CREDENTIAL_KEYS: z
      .string()
      .transform((value, context) => {
        try {
          const parsed: unknown = JSON.parse(value);
          return parsed;
        } catch {
          context.addIssue({ code: "custom", message: "must be JSON" });
          return z.NEVER;
        }
      })
      .pipe(z.record(z.string().min(1), credentialKey)),
    JIRA_CREDENTIAL_KEY_CURRENT: z.string().min(1),
  })
  .refine(
    (env) =>
      Object.hasOwn(env.JIRA_CREDENTIAL_KEYS, env.JIRA_CREDENTIAL_KEY_CURRENT),
    {
      message: "names a version that JIRA_CREDENTIAL_KEYS does not have",
      path: ["JIRA_CREDENTIAL_KEY_CURRENT"],
    },
  );

export type CredentialEnv = z.infer<typeof CredentialEnvSchema>;

/** Validates the credential key ring. */
export const parseCredentialEnv = (env: unknown): CredentialEnv =>
  parseEnvPart(
    CredentialEnvSchema,
    env,
    "Jira credential encryption",
    "ADR-0027",
  );
