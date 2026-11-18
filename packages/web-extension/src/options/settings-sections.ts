import { ADD_SITE_ANCHOR_ID } from "./anchor-id.js";

export type SectionId =
  | "sync-server"
  | "your-jira-account"
  | "sites"
  | "workspaces"
  | "jira-accounts";

export const SECTION_TITLES: Record<SectionId, string> = {
  "sync-server": "Sync server",
  "your-jira-account": "Your Jira account",
  sites: "Sites",
  workspaces: "Workspaces",
  "jira-accounts": "Jira accounts",
};

export const SECTION_ORDER: SectionId[] = [
  "sync-server",
  "your-jira-account",
  "sites",
  "workspaces",
  "jira-accounts",
];

const isSectionId = (value: string): value is SectionId =>
  Object.hasOwn(SECTION_TITLES, value);

// The ids inside a section that a link can point to (anchor-id.ts and the add forms).
const SECTION_BY_PREFIX: ReadonlyArray<[string, SectionId]> = [
  ["workspace-", "workspaces"],
  ["jira-account-", "jira-accounts"],
  ["add-jira-account", "jira-accounts"],
  [ADD_SITE_ANCHOR_ID, "sites"],
];

/**
 * The section that shows for a URL hash: the section itself (`#sites`) or the
 * one that holds the linked row (`#workspace-storefront`).
 */
export const sectionOfHash = (hash: string, fallback: SectionId): SectionId => {
  const id = hash.replace(/^#/, "");
  if (isSectionId(id)) return id;
  const match = SECTION_BY_PREFIX.find(([prefix]) => id.startsWith(prefix));
  return match ? match[1] : fallback;
};
