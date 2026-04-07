/**
 * Membership predicates for selections relative to groups.
 *
 * Compiled against a structural shape (`{ groupId: string | null }`) rather
 * than `CommentItem` directly so this module can land before `CommentItem`
 * is widened to nullable in the atomic Task 2 commit.
 */
interface HasMembership {
  groupId: string | null;
}

export const isUngrouped = (item: HasMembership): boolean =>
  item.groupId === null;

export const belongsTo = (item: HasMembership, groupId: string): boolean =>
  item.groupId === groupId;
