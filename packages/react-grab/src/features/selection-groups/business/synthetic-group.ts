import type { SelectionGroup } from "../types.js";
import { generateId } from "../../../utils/generate-id.js";

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
 * synthetic group's `name`, which feeds `defaultSummary(group)` in the
 * Jira create form.
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
 * Guarantee every item has a group. If `activeGroupId` is set (user picked
 * a group in the picker), returns it — no new group needed. Otherwise
 * creates a synthetic group so the item is never ungrouped.
 *
 * Pure function — does NOT persist. Returns the (possibly augmented) groups
 * array and the groupId to assign. The caller persists if `groups` changed.
 */
export const ensureGroupForItem = (
  item: SyntheticGroupSeed,
  activeGroupId: string | null,
  currentGroups: SelectionGroup[],
): { groups: SelectionGroup[]; groupId: string } => {
  if (activeGroupId) {
    return { groups: currentGroups, groupId: activeGroupId };
  }
  const syntheticGroup = createSyntheticGroupForItem(item);
  return {
    groups: [...currentGroups, syntheticGroup],
    groupId: syntheticGroup.id,
  };
};

/**
 * Predicate for "is this a synthetic group?" — used by every filter that
 * needs to hide synthetic groups from user-facing lists.
 */
export const isSynthetic = (group: SelectionGroup): boolean =>
  group.synthetic === true;

/**
 * Single source of truth for "which groups should user-facing surfaces
 * (label picker, group list, comments dropdown, stats, filters) show?".
 * Synthetic groups are always invisible — their single item renders as
 * a loose card via `isPresentedAsLoose`.
 *
 * Every consumer that renders a group list or a group picker should
 * call this rather than reimplementing the filter. Prevents drift when
 * the "user-facing" rule evolves (e.g. adding archived groups later).
 */
export const filterUserFacingGroups = <T extends SelectionGroup>(
  groups: T[],
): T[] => groups.filter((g) => !isSynthetic(g));

/**
 * GC pass: drop any synthetic groups that no longer have items pointing
 * at them. Real groups survive emptiness by design — only synthetic
 * backing stores are garbage-collected.
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
  return groups.filter((g) => !isSynthetic(g) || occupied.has(g.id));
};
