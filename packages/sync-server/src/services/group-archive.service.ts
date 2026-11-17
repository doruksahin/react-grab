import type { Group, SyncRepository } from "../repositories/types.js";

/*
 * Archiving (ADR-0030): the step before delete. Any group, with or without a
 * ticket, is archived as a whole; a loose selection through its own
 * synthetic group. Restoring brings it back. The server sets the time, so
 * clients never write the field.
 */

export type ArchiveRefusal = "group-not-found";

export type ArchiveResult =
  | { status: "done"; group: Group }
  | { status: "refused"; reason: ArchiveRefusal };

export const ARCHIVE_REFUSAL_MESSAGES: Record<ArchiveRefusal, string> = {
  "group-not-found": "The group does not exist",
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

  /** Archives a group. Archiving an archived group keeps its time. */
  async archive(workspaceId: string, groupId: string): Promise<ArchiveResult> {
    const group = await this.deps.repo.findGroup(workspaceId, groupId);
    if (!group) return { status: "refused", reason: "group-not-found" };
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
