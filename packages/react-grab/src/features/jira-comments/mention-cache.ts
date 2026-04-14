import type { JiraUserSuggestion } from "./types.js";

const CACHE_TTL = 60_000;
const cache = new Map<string, { users: JiraUserSuggestion[]; ts: number }>();

export function getCachedUsers(query: string): JiraUserSuggestion[] | null {
  const entry = cache.get(query);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.users;
  if (entry) cache.delete(query);
  return null;
}

export function setCachedUsers(query: string, users: JiraUserSuggestion[]): void {
  cache.set(query, { users, ts: Date.now() });
}
