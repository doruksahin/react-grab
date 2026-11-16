import { and, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema.js";
import { D1WorkspaceRepository } from "./workspaces.repo.js";
import type {
  Comment,
  Group,
  GroupWrite,
  SyncRepository,
  TicketOrigin,
} from "./types.js";

type Database = DrizzleD1Database<typeof schema>;

export class D1SyncRepository implements SyncRepository {
  private readonly workspaces: D1WorkspaceRepository;

  constructor(private readonly db: Database) {
    this.workspaces = new D1WorkspaceRepository(db);
  }

  /** A write to a workspace makes it exist, so the settings can list it (ADR-0027). */
  private ensureWorkspace(workspaceId: string): Promise<void> {
    return this.workspaces.ensure(workspaceId);
  }

  async listComments(workspaceId: string): Promise<Comment[]> {
    const rows = await this.db
      .select()
      .from(schema.comments)
      .where(eq(schema.comments.workspaceId, workspaceId));

    return rows.map(rowToComment);
  }

  async upsertComment(workspaceId: string, item: Comment): Promise<void> {
    // PUT semantics: the stored comment becomes exactly what was sent, so an
    // optional field the client left out is cleared rather than kept.
    await this.ensureWorkspace(workspaceId);
    await this.db
      .insert(schema.comments)
      .values({ ...item, workspaceId })
      .onConflictDoUpdate({
        target: [schema.comments.id, schema.comments.workspaceId],
        set: {
          groupId: item.groupId,
          content: item.content,
          elementName: item.elementName,
          tagName: item.tagName,
          componentName: item.componentName ?? null,
          elementsCount: item.elementsCount ?? null,
          elementSelectors: item.elementSelectors ?? null,
          commentText: item.commentText ?? null,
          timestamp: item.timestamp,
          revealed: item.revealed ?? null,
          status: item.status ?? null,
          pageUrl: item.pageUrl ?? null,
          pageTitle: item.pageTitle ?? null,
          screenshotFullPage: item.screenshotFullPage ?? null,
          screenshotElement: item.screenshotElement ?? null,
          recordingUrl: item.recordingUrl ?? null,
          steps: item.steps ?? null,
          jiraTicketId: item.jiraTicketId ?? null,
          capturedBy: item.capturedBy ?? null,
        },
      });
  }

  async findComment(
    workspaceId: string,
    commentId: string,
  ): Promise<Comment | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.comments)
      .where(
        and(
          eq(schema.comments.id, commentId),
          eq(schema.comments.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    return row ? rowToComment(row) : undefined;
  }

  async deleteComment(workspaceId: string, commentId: string): Promise<void> {
    await this.db
      .delete(schema.comments)
      .where(
        and(
          eq(schema.comments.id, commentId),
          eq(schema.comments.workspaceId, workspaceId),
        ),
      );
  }

  async listGroups(workspaceId: string): Promise<Group[]> {
    const rows = await this.db
      .select()
      .from(schema.groups)
      .where(eq(schema.groups.workspaceId, workspaceId));

    return rows.map(rowToGroup);
  }

  async upsertGroup(workspaceId: string, item: GroupWrite): Promise<void> {
    // Only client-owned columns are written. status and jiraTicketId belong
    // to the server (set by updateGroupJira when a ticket is created), so an
    // update from a client that has not seen the ticket cannot erase it —
    // which is what let a second, duplicate Jira ticket through (ADR-0019).
    const { id, name, createdAt, revealed, synthetic } = item;
    await this.ensureWorkspace(workspaceId);
    await this.db
      .insert(schema.groups)
      .values({ id, workspaceId, name, createdAt, revealed, synthetic })
      .onConflictDoUpdate({
        target: [schema.groups.id, schema.groups.workspaceId],
        set: {
          name,
          createdAt,
          revealed: revealed ?? null,
          synthetic: synthetic ?? null,
        },
      });
  }

  async findGroup(
    workspaceId: string,
    groupId: string,
  ): Promise<Group | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.groups)
      .where(
        and(
          eq(schema.groups.id, groupId),
          eq(schema.groups.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    return row ? rowToGroup(row) : undefined;
  }

  async deleteGroup(workspaceId: string, groupId: string): Promise<void> {
    await this.db
      .delete(schema.groups)
      .where(
        and(
          eq(schema.groups.id, groupId),
          eq(schema.groups.workspaceId, workspaceId),
        ),
      );
  }

  async updateGroupJira(
    workspaceId: string,
    groupId: string,
    jiraTicketId: string,
    jiraAccountId: string | null,
  ): Promise<void> {
    await this.db
      .update(schema.groups)
      .set({ jiraTicketId, jiraAccountId, status: "ticketed" })
      .where(
        and(
          eq(schema.groups.id, groupId),
          eq(schema.groups.workspaceId, workspaceId),
        ),
      );
  }

  async findTicketOrigin(
    workspaceId: string,
    groupId: string,
  ): Promise<TicketOrigin | undefined> {
    const [row] = await this.db
      .select({
        jiraTicketId: schema.groups.jiraTicketId,
        jiraAccountId: schema.groups.jiraAccountId,
      })
      .from(schema.groups)
      .where(
        and(
          eq(schema.groups.id, groupId),
          eq(schema.groups.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    return row?.jiraTicketId
      ? { jiraTicketId: row.jiraTicketId, jiraAccountId: row.jiraAccountId }
      : undefined;
  }
}

// ── Row mappers (null → undefined for optional Zod fields) ──────────

function rowToComment(row: typeof schema.comments.$inferSelect): Comment {
  const { workspaceId, ...rest } = row;
  return {
    ...rest,
    componentName: rest.componentName ?? undefined,
    elementsCount: rest.elementsCount ?? undefined,
    elementSelectors: rest.elementSelectors ?? undefined,
    commentText: rest.commentText ?? undefined,
    timestamp: rest.timestamp,
    revealed: rest.revealed ?? undefined,
    status: rest.status ?? undefined,
    pageUrl: rest.pageUrl ?? undefined,
    pageTitle: rest.pageTitle ?? undefined,
    screenshotFullPage: rest.screenshotFullPage ?? undefined,
    screenshotElement: rest.screenshotElement ?? undefined,
    recordingUrl: rest.recordingUrl ?? undefined,
    steps: rest.steps ?? undefined,
    jiraTicketId: rest.jiraTicketId ?? undefined,
    capturedBy: rest.capturedBy ?? undefined,
  };
}

function rowToGroup(row: typeof schema.groups.$inferSelect): Group {
  // The ticket origin stays on the server: clients name a workspace, never an account.
  const { workspaceId, jiraAccountId, ...rest } = row;
  return {
    ...rest,
    revealed: rest.revealed ?? undefined,
    status: rest.status ?? undefined,
    jiraTicketId: rest.jiraTicketId ?? undefined,
    synthetic: rest.synthetic ?? undefined,
  };
}
