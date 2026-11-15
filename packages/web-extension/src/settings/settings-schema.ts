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

export const serverUrlSchema = z
  .string()
  .trim()
  .refine(isWebUrl, "Enter an http or https address")
  .transform((value) => value.replace(/\/+$/, ""));

export const apiTokenSchema = z.string().trim().min(1, "Enter the API token");

export const siteSettingsSchema = z.strictObject({
  workspace: z.string().trim().min(1, "Enter a workspace"),
  jiraProjectKey: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]*$/, "Enter a Jira project key, for example ATT"),
}) satisfies z.ZodType<SiteSettings>;
