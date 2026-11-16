import { z } from "zod";
import type { SiteSettings } from "./types.js";

const WEB_PROTOCOLS = new Set(["http:", "https:"]);

const isWebUrl = (value: string): boolean =>
  URL.canParse(value) && WEB_PROTOCOLS.has(new URL(value).protocol);

export const siteOriginSchema = z
  .string()
  .trim()
  .refine(isWebUrl, "Enter an http or https address")
  .transform((value) => new URL(value).origin);

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

const isSecureServerUrl = (url: URL): boolean =>
  url.protocol === "https:" ||
  (url.protocol === "http:" && LOCAL_HOSTNAMES.has(url.hostname));

const hasOnlyOriginAndPath = (url: URL): boolean =>
  !url.username && !url.password && !url.search && !url.hash;

export const serverUrlSchema = z
  .string()
  .trim()
  .refine(URL.canParse, "Enter the server's address")
  .transform((value) => new URL(value))
  .refine(
    isSecureServerUrl,
    "Use https; http is allowed only for localhost, 127.0.0.1 and [::1]",
  )
  .refine(
    hasOnlyOriginAndPath,
    "Remove the user name, password, query and fragment from the address",
  )
  .transform((url) => `${url.origin}${url.pathname.replace(/\/+$/, "")}`);

export const apiTokenSchema = z.string().trim().min(1, "Enter the API token");

export const siteSettingsSchema = z.strictObject({
  workspace: z.string().trim().min(1, "Enter a workspace"),
  jiraProjectKey: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]*$/, "Enter a Jira project key, for example ATT"),
  recordSteps: z.boolean(),
  recordSession: z.boolean(),
}) satisfies z.ZodType<SiteSettings>;
