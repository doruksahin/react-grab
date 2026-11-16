import type { Group, SyncRepository } from "../repositories/types.js";

/*
 * Deleting a selection (ADR-0008, amended 2026-11-16): a selection whose
 * group has a Jira ticket cannot be deleted, and neither can a ticketed
 * group. The ticket is set here on the server (updateGroupJira), so the
 * server has the last word; the overlay checks the same rule first only to
 * avoid offering an action that this service refuses.
 */

export type DeletionRefusal = "selection-has-ticket" | "group-has-ticket";

export type DeletionResult =
  | { status: "deleted" }
  | { status: "refused"; reason: DeletionRefusal };

/** A group has a ticket iff it carries a Jira ticket id. */
export const isTicketed = (group: Pick<Group, "jiraTicketId">): boolean =>
  Boolean(group.jiraTicketId);

export class DeletionService {
  constructor(private readonly repo: SyncRepository) {}

  /** Deletes a comment unless its group has a ticket. Absent counts as deleted. */
  async deleteComment(
    workspaceId: string,
    commentId: string,
  ): Promise<DeletionResult> {
    const comment = await this.repo.findComment(workspaceId, commentId);
    if (comment) {
      const group = await this.repo.findGroup(workspaceId, comment.groupId);
      if (group && isTicketed(group)) {
        return { status: "refused", reason: "selection-has-ticket" };
      }
    }
    await this.repo.deleteComment(workspaceId, commentId);
    return { status: "deleted" };
  }

  /** Deletes a group unless it has a ticket. Absent counts as deleted. */
  async deleteGroup(
    workspaceId: string,
    groupId: string,
  ): Promise<DeletionResult> {
    const group = await this.repo.findGroup(workspaceId, groupId);
    if (group && isTicketed(group)) {
      return { status: "refused", reason: "group-has-ticket" };
    }
    await this.repo.deleteGroup(workspaceId, groupId);
    return { status: "deleted" };
  }
}
