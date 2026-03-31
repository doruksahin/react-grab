import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema.js";
import type { Comment, Group, SyncRepository } from "./types.js";

type Database = DrizzleD1Database<typeof schema>;

export class D1SyncRepository implements SyncRepository {
  constructor(private readonly db: Database) {}

  async listComments(workspaceId: string): Promise<Comment[]> {
    const rows = await this.db
      .select()
      .from(schema.comments)
      .where(eq(schema.comments.workspaceId, workspaceId));

    return rows.map(rowToComment);
  }

  async persistComments(
    workspaceId: string,
    items: Comment[],
  ): Promise<void> {
    await this.db.batch([
      this.db
        .delete(schema.comments)
        .where(eq(schema.comments.workspaceId, workspaceId)),
      ...items.map((item) =>
        this.db.insert(schema.comments).values({ ...item, workspaceId }),
      ),
    ]);
  }

  async listGroups(workspaceId: string): Promise<Group[]> {
    const rows = await this.db
      .select()
      .from(schema.groups)
      .where(eq(schema.groups.workspaceId, workspaceId));

    return rows.map(rowToGroup);
  }

  async persistGroups(
    workspaceId: string,
    items: Group[],
  ): Promise<void> {
    await this.db.batch([
      this.db
        .delete(schema.groups)
        .where(eq(schema.groups.workspaceId, workspaceId)),
      ...items.map((item) =>
        this.db.insert(schema.groups).values({ ...item, workspaceId }),
      ),
    ]);
  }
}

// ── Row mappers (null → undefined for optional Zod fields) ──────────

function rowToComment(
  row: typeof schema.comments.$inferSelect,
): Comment {
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
    jiraTicketId: rest.jiraTicketId ?? undefined,
    capturedBy: rest.capturedBy ?? undefined,
  };
}

function rowToGroup(
  row: typeof schema.groups.$inferSelect,
): Group {
  const { workspaceId, ...rest } = row;
  return {
    ...rest,
    revealed: rest.revealed ?? undefined,
  };
}
