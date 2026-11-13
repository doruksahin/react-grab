import { env } from "cloudflare:test";

/** Headers that pass the API token check in route tests (ADR-0020). */
export const authorized = (
  extra: Record<string, string> = {},
): Record<string, string> => ({
  Authorization: `Bearer ${env.SYNC_API_TOKEN}`,
  ...extra,
});
