/**
 * Membership predicates for selections relative to groups.
 *
 * Every selection always belongs to a group (real or synthetic).
 * These predicates classify items for rendering and business rules.
 */
import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";
import { isSynthetic } from "./synthetic-group.js";

interface HasMembership {
  groupId: string | null;
}

export const belongsTo = (item: HasMembership, groupId: string): boolean =>
  item.groupId === groupId;

/** How many selections live in each group. */
const memberCounts = (items: HasMembership[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.groupId !== null)
      counts.set(item.groupId, (counts.get(item.groupId) ?? 0) + 1);
  }
  return counts;
};

/**
 * Single source of truth for "should this item be rendered as a loose card?"
 *
 * An item is presented as loose when it lives in a synthetic group that
 * contains exactly one item, or when its group is missing. Synthetic groups
 * are invisible to the user — their single item renders as ungrouped in
 * every surface. An item whose group is gone stays visible as loose rather
 * than disappearing.
 *
 * This predicate is the only place that knows about the synthetic-group
 * rendering rule. Every render path consults this function rather than
 * reimplementing the check.
 */
export const isPresentedAsLoose = (
  item: CommentItem,
  groups: SelectionGroup[],
  allItems: CommentItem[],
): boolean => {
  if (item.groupId === null) return true;
  const group = groups.find((g) => g.id === item.groupId);
  if (!group) return true;
  if (!isSynthetic(group)) return false;
  return memberCounts(allItems).get(group.id) === 1;
};

/**
 * The groups user-facing surfaces (group list, comments panel, stats,
 * filters) show. Real groups always; a synthetic group only when it holds
 * more than one selection, which the membership policy never produces but
 * older data can contain. It is then shown, named after its ticket, so its
 * selections do not vanish. Read-only: nothing is written back.
 */
export const presentedGroups = <Group extends SelectionGroup>(
  groups: Group[],
  items: HasMembership[],
): Group[] => {
  const counts = memberCounts(items);
  return groups
    .filter((g) => !isSynthetic(g) || (counts.get(g.id) ?? 0) > 1)
    .map((g) =>
      isSynthetic(g) && g.jiraTicketId ? { ...g, name: g.jiraTicketId } : g,
    );
};

export type MembershipAnomaly =
  | { kind: "crowded-synthetic-group"; groupId: string; members: number }
  | { kind: "missing-group"; itemId: string; groupId: string };

/**
 * Data the membership policy would never produce: a synthetic group with
 * several selections, or a selection pointing at a group that does not
 * exist. Reported so the owner can repair the data deliberately.
 */
export const membershipAnomalies = (
  groups: SelectionGroup[],
  items: Array<HasMembership & { id: string }>,
): MembershipAnomaly[] => {
  const counts = memberCounts(items);
  const groupIds = new Set(groups.map((g) => g.id));
  const crowded: MembershipAnomaly[] = groups
    .filter((g) => isSynthetic(g) && (counts.get(g.id) ?? 0) > 1)
    .map((g) => ({
      kind: "crowded-synthetic-group",
      groupId: g.id,
      members: counts.get(g.id) ?? 0,
    }));
  const missing: MembershipAnomaly[] = items.flatMap((item) =>
    item.groupId !== null && !groupIds.has(item.groupId)
      ? [{ kind: "missing-group", itemId: item.id, groupId: item.groupId }]
      : [],
  );
  return [...crowded, ...missing];
};

/**
 * What a ticket created from a selection covers: a synthetic group's own
 * selection, or every selection of a real group. Null when the selection's
 * group is missing.
 */
export const ticketScopeFor = (
  item: CommentItem,
  groups: SelectionGroup[],
  allItems: CommentItem[],
): { group: SelectionGroup; items: CommentItem[] } | null => {
  const group = groups.find((g) => g.id === item.groupId);
  if (!group) return null;
  return {
    group,
    items: isSynthetic(group)
      ? [item]
      : allItems.filter((entry) => entry.groupId === group.id),
  };
};
