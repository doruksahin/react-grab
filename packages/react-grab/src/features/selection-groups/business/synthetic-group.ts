import type { SelectionGroup } from "../types.js";
import { generateId } from "../../../utils/generate-id.js";
import { isTicketed } from "./ticket-lock.js";

/** Minimal shape needed to name a synthetic group. */
interface SyntheticGroupSeed {
  componentName?: string;
  elementName: string;
}

/**
 * Synthetic-group operations. Every selection always belongs to a group.
 * When the user hasn't picked a real group, a synthetic group is
 * auto-created at selection time so the item is never ungrouped. Synthetic
 * groups are invisible in user-facing surfaces; their single item renders
 * as a loose card via `isPresentedAsLoose`.
 *
 * SRP: this module owns the *creation*, *identification*, and *lifecycle*
 * of synthetic groups. It does NOT own:
 *   - the rendering rule (that's `business/membership.ts/isPresentedAsLoose`)
 *   - the dialog flow (that's wired in `core/index.tsx` and the sidebar)
 *   - persistence (that's the sync layer)
 */

/**
 * Best-effort name inferred from the item being ticketed. Used as the
 * synthetic group's `name`, the fallback of `defaultSummary` (features/jira-ticket) when the item
 * has no comment text.
 */
export const inferSyntheticGroupName = (item: SyntheticGroupSeed): string =>
  item.componentName || item.elementName || "Untitled";

/**
 * Build a fresh SelectionGroup tagged as synthetic. Pure function — does
 * NOT persist. The caller is responsible for storing the result via the
 * orchestrator's `setGroups` / `persistGroups`.
 */
export const createSyntheticGroupForItem = (
  item: SyntheticGroupSeed,
): SelectionGroup => ({
  id: generateId("group"),
  name: inferSyntheticGroupName(item),
  createdAt: Date.now(),
  revealed: false,
  synthetic: true,
});

/**
 * Predicate for "is this a synthetic group?" — used by every filter that
 * needs to hide synthetic groups from user-facing lists.
 */
export const isSynthetic = (group: SelectionGroup): boolean =>
  group.synthetic === true;

/**
 * GC pass: drop any synthetic groups that no longer have items pointing
 * at them. Real groups survive emptiness by design — only synthetic
 * backing stores are garbage-collected. A synthetic group with a ticket is
 * never collected: a ticketed group cannot be deleted (ADR-0008).
 *
 * Pure function. The caller is responsible for persisting the result.
 * Every selection mutation that can empty a group (move, remove) should
 * run through this before setting the new groups state.
 */
export const gcEmptySyntheticGroups = (
  groups: SelectionGroup[],
  items: { groupId: string | null }[],
): SelectionGroup[] => {
  const occupied = new Set<string>();
  for (const item of items) {
    if (item.groupId !== null) occupied.add(item.groupId);
  }
  return groups.filter(
    (g) => !isSynthetic(g) || isTicketed(g) || occupied.has(g.id),
  );
};
