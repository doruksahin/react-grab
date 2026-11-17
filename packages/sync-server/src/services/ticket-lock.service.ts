import type { Comment, Group, SyncRepository } from "../repositories/types.js";

/*
 * The ticket lock on the server (ADR-0008, amended 2026-11-16). A selection
 * whose group has a Jira ticket cannot be deleted or moved to another group,
 * a ticketed group takes no new selections, and a ticketed group cannot be
 * deleted. The ticket is set here on the server (updateGroupJira), so the
 * server has the last word; the overlay checks the same rule first only to
 * avoid offering an action that this service refuses.
 */

export type TicketLockRefusal =
  | "selection-has-ticket"
  | "group-has-ticket"
  | "target-group-has-ticket";

export type TicketLockResult =
  | { status: "done" }
  | { status: "refused"; reason: TicketLockRefusal };

/** A group has a ticket iff it carries a Jira ticket id. */
export const isTicketed = (group: Pick<Group, "jiraTicketId">): boolean =>
  Boolean(group.jiraTicketId);

export const REFUSAL_MESSAGES: Record<TicketLockRefusal, string> = {
  "selection-has-ticket":
    "A comment whose group has a Jira ticket cannot be deleted or moved",
  "group-has-ticket": "A group with a Jira ticket cannot be deleted",
  "target-group-has-ticket": "A group with a Jira ticket takes no new comments",
};

const DONE: TicketLockResult = { status: "done" };

const refused = (reason: TicketLockRefusal): TicketLockResult => ({
  status: "refused",
  reason,
});

export class TicketLockService {
  constructor(private readonly repo: SyncRepository) {}

  private async isGroupTicketed(
    workspaceId: string,
    groupId: string,
  ): Promise<boolean> {
    const group = await this.repo.findGroup(workspaceId, groupId);
    return Boolean(group && isTicketed(group));
  }

  /**
   * Writes a comment unless the write moves it out of a ticketed group, or
   * into one. Updating a comment that stays in its group is always allowed.
   */
  async upsertComment(
    workspaceId: string,
    item: Comment,
  ): Promise<TicketLockResult> {
    const stored = await this.repo.findComment(workspaceId, item.id);
    if (stored?.groupId !== item.groupId) {
      if (stored && (await this.isGroupTicketed(workspaceId, stored.groupId))) {
        return refused("selection-has-ticket");
      }
      if (await this.isGroupTicketed(workspaceId, item.groupId)) {
        return refused("target-group-has-ticket");
      }
    }
    await this.repo.upsertComment(workspaceId, item);
    return DONE;
  }

  /** Deletes a comment unless its group has a ticket. Absent counts as deleted. */
  async deleteComment(
    workspaceId: string,
    commentId: string,
  ): Promise<TicketLockResult> {
    const stored = await this.repo.findComment(workspaceId, commentId);
    if (stored && (await this.isGroupTicketed(workspaceId, stored.groupId))) {
      return refused("selection-has-ticket");
    }
    await this.repo.deleteComment(workspaceId, commentId);
    return DONE;
  }

  /**
   * Deletes a group unless it has a ticket. Absent counts as deleted. An
   * archived group goes with its comments, in one batch: they were off the
   * board and must not come back as loose selections (ADR-0030).
   */
  async deleteGroup(
    workspaceId: string,
    groupId: string,
  ): Promise<TicketLockResult> {
    const group = await this.repo.findGroup(workspaceId, groupId);
    if (group && isTicketed(group)) return refused("group-has-ticket");
    if (group?.archivedAt !== undefined) {
      await this.repo.deleteGroupWithComments(workspaceId, groupId);
    } else {
      await this.repo.deleteGroup(workspaceId, groupId);
    }
    return DONE;
  }
}
