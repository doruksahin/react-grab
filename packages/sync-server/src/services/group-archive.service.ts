import type { Group, SyncRepository } from "../repositories/types.js";
import { isTicketed } from "./ticket-lock.service.js";

/*
 * Archiving (ADR-0030). A group with a Jira ticket cannot be deleted
 * (ADR-0008); archiving takes it off the board instead and restoring brings
 * it back. Only a ticketed group is archived: one without a ticket is
 * deleted. The server sets the time, so clients never write the field.
 */

export type ArchiveRefusal = "group-not-found" | "group-has-no-ticket";

export type ArchiveResult =
  | { status: "done"; group: Group }
  | { status: "refused"; reason: ArchiveRefusal };

export const ARCHIVE_REFUSAL_MESSAGES: Record<ArchiveRefusal, string> = {
  "group-not-found": "The group does not exist",
  "group-has-no-ticket":
    "Only a group with a Jira ticket is archived; delete it instead",
};

export interface GroupArchiveServiceDeps {
  repo: SyncRepository;
  now?: () => number;
}

export class GroupArchiveService {
  private readonly now: () => number;

  constructor(private readonly deps: GroupArchiveServiceDeps) {
    this.now = deps.now ?? Date.now;
  }

  /** Archives a ticketed group. Archiving an archived group keeps its time. */
  async archive(workspaceId: string, groupId: string): Promise<ArchiveResult> {
    const group = await this.deps.repo.findGroup(workspaceId, groupId);
    if (!group) return { status: "refused", reason: "group-not-found" };
    if (!isTicketed(group)) {
      return { status: "refused", reason: "group-has-no-ticket" };
    }
    if (group.archivedAt !== undefined) return { status: "done", group };
    const archivedAt = this.now();
    await this.deps.repo.setGroupArchived(workspaceId, groupId, archivedAt);
    return { status: "done", group: { ...group, archivedAt } };
  }

  /** Restores a group to the board. Restoring an active group does nothing. */
  async restore(workspaceId: string, groupId: string): Promise<ArchiveResult> {
    const group = await this.deps.repo.findGroup(workspaceId, groupId);
    if (!group) return { status: "refused", reason: "group-not-found" };
    if (group.archivedAt === undefined) return { status: "done", group };
    await this.deps.repo.setGroupArchived(workspaceId, groupId, null);
    const { archivedAt: _archivedAt, ...active } = group;
    return { status: "done", group: active };
  }
}
