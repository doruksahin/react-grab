/**
 * Ticket-lock: the business rule that freezes a selection once its group
 * has a JIRA ticket attached.
 *
 *   > A selection bound to a ticketed group is frozen.
 *   > Its group cannot change, and ticketed groups cannot receive new
 *   > members.
 *
 * This file is the single source of truth for that invariant. Every
 * surface that lets a user reassign a selection (picker, move menu,
 * keyboard shortcut, drag-drop) must consult these predicates — never
 * re-derive the rule inline.
 *
 * Synthetic groups count: a loose selection that earned a ticket lives
 * in a synthetic backing group, and it is just as locked as a real
 * ticketed group. The rule is "has ticket → locked", regardless of
 * whether the group is real or synthetic, resolved or open.
 */
import type { SelectionGroup } from "../types.js";
import { isSynthetic } from "./synthetic-group.js";

interface HasMembership {
  groupId: string | null;
}

/** A group is ticketed iff it carries a JIRA ticket id. */
export const isTicketed = (group: SelectionGroup): boolean =>
  Boolean(group.jiraTicketId);

/**
 * A selection is locked iff its current group (real or synthetic) is
 * ticketed. Ungrouped selections are never locked.
 */
export const isSelectionLocked = (
  item: HasMembership,
  groups: SelectionGroup[],
): boolean => {
  if (item.groupId === null) return false;
  const group = groups.find((g) => g.id === item.groupId);
  return Boolean(group && isTicketed(group));
};

/**
 * Groups that this selection may be reassigned into.
 *
 *   - Locked selections have no assignable targets (empty list).
 *   - Ticketed groups are never valid targets (can't dump new items
 *     into an existing ticket).
 *   - Synthetic groups are never valid targets (they're UI-invisible
 *     backing stores for loose-with-ticket).
 */
export const assignableGroupsFor = (
  item: HasMembership,
  groups: SelectionGroup[],
): SelectionGroup[] => {
  if (isSelectionLocked(item, groups)) return [];
  return groups.filter((g) => !isTicketed(g) && !isSynthetic(g));
};

/**
 * Write-inverse of the lock: a selection may be removed iff it is not
 * locked. Removing a ticketed selection would orphan the JIRA issue, so
 * ticket-lock forbids it. Same predicate, different verb.
 */
export const canRemoveSelection = (
  item: HasMembership,
  groups: SelectionGroup[],
): boolean => !isSelectionLocked(item, groups);
