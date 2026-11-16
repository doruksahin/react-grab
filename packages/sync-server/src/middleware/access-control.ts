import { bearerAuth } from "hono/bearer-auth";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { isAllowedOrigin } from "../lib/allowed-origin.js";
import { AdminEnvSchema, parseAdminEnv, parseAuthEnv } from "../schemas/env.js";
import type { AppEnv } from "../types.js";

/**
 * CORS limited to local dev servers plus `ALLOWED_ORIGINS` (ADR-0020).
 *
 * Built per request so it can read the environment — the pattern Hono's CORS
 * documentation gives for env-dependent options. It runs before the token
 * check, so a preflight succeeds without a credential, as the protocol needs.
 */
export const corsForCallers = createMiddleware<AppEnv>(async (c, next) => {
  const handler = cors({
    // c.env is absent when the app runs outside Workers, as export-spec does.
    origin: (origin) =>
      isAllowedOrigin(origin, c.env?.ALLOWED_ORIGINS) ? origin : null,
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "PUT", "POST", "DELETE", "OPTIONS"],
    maxAge: 600,
  });
  return handler(c, next);
});

/**
 * Every API request must carry `Authorization: Bearer <SYNC_API_TOKEN>`.
 * Uses Hono's built-in bearerAuth, so the comparison is its constant-time one.
 * Fails closed: if the token is not configured, parseAuthEnv throws and no
 * request gets through.
 */
export const requireApiToken = createMiddleware<AppEnv>(async (c, next) => {
  const { SYNC_API_TOKEN } = parseAuthEnv(c.env);
  // The admin token may do everything the sync token does (ADR-0027).
  const admin = AdminEnvSchema.safeParse(c.env);
  const token = admin.success
    ? [SYNC_API_TOKEN, admin.data.SYNC_ADMIN_TOKEN]
    : SYNC_API_TOKEN;
  return bearerAuth({ token })(c, next);
});

/**
 * Managing Jira accounts and workspace destinations needs
 * `Authorization: Bearer <SYNC_ADMIN_TOKEN>` (ADR-0027). Host apps hold only
 * the sync token, so a script on their pages cannot redirect tickets. Fails
 * closed: without a configured admin token, no admin request gets through.
 */
export const requireAdminToken = createMiddleware<AppEnv>(async (c, next) => {
  const { SYNC_ADMIN_TOKEN } = parseAdminEnv(c.env);
  return bearerAuth({ token: SYNC_ADMIN_TOKEN })(c, next);
});
