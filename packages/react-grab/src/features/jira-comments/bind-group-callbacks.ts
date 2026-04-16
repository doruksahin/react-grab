import type {
  GroupCommentCallbacks,
  JiraCommentsSectionProps,
} from "./types.js";

type BoundSectionCallbacks = Pick<
  JiraCommentsSectionProps,
  "onSubmitComment" | "onSearchUsers" | "onRefreshPoll"
>;

/**
 * Bind group-scoped JIRA comment callbacks to a specific groupId,
 * producing the pre-bound shape that CommentsSection expects.
 *
 * Eliminates the adapter boilerplate that would otherwise duplicate
 * across every surface rendering a group's comment thread.
 */
export const bindGroupCommentCallbacks = (
  groupId: string,
  callbacks: GroupCommentCallbacks,
): BoundSectionCallbacks => ({
  onSubmitComment: (markdown, mentions, parentId) =>
    callbacks.onSubmitComment(groupId, markdown, mentions, parentId),
  onSearchUsers: callbacks.onSearchUsers,
  onRefreshPoll: () => callbacks.onRefreshStatus?.(groupId),
});
