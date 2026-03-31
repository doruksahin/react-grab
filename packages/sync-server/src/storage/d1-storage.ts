import { eq } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema.js";

export type Database = DrizzleD1Database<typeof schema>;

export const createDb = (d1: D1Database): Database =>
  drizzle(d1, { schema });

export const listComments = async (db: Database, workspaceId: string) => {
  const rows = await db
    .select()
    .from(schema.comments)
    .where(eq(schema.comments.workspaceId, workspaceId));

  return rows.map(rowToComment);
};

export const persistComments = async (
  db: Database,
  workspaceId: string,
  items: Omit<schema.CommentInsert, "workspaceId">[],
) => {
  // Delete all existing comments for this workspace, then insert new ones
  await db.batch([
    db.delete(schema.comments).where(eq(schema.comments.workspaceId, workspaceId)),
    ...items.map((item) =>
      db.insert(schema.comments).values({ ...item, workspaceId }),
    ),
  ]);
};

export const listGroups = async (db: Database, workspaceId: string) => {
  const rows = await db
    .select()
    .from(schema.groups)
    .where(eq(schema.groups.workspaceId, workspaceId));

  return rows.map(rowToGroup);
};

export const persistGroups = async (
  db: Database,
  workspaceId: string,
  items: Omit<schema.GroupInsert, "workspaceId">[],
) => {
  await db.batch([
    db.delete(schema.groups).where(eq(schema.groups.workspaceId, workspaceId)),
    ...items.map((item) =>
      db.insert(schema.groups).values({ ...item, workspaceId }),
    ),
  ]);
};

// --- Row mappers: strip workspaceId, match API shape ---

function rowToComment(row: typeof schema.comments.$inferSelect) {
  const { workspaceId, ...rest } = row;
  return {
    ...rest,
    componentName: rest.componentName ?? undefined,
    elementsCount: rest.elementsCount ?? undefined,
    elementSelectors: rest.elementSelectors ?? undefined,
    commentText: rest.commentText ?? undefined,
    status: rest.status ?? undefined,
    pageUrl: rest.pageUrl ?? undefined,
    pageTitle: rest.pageTitle ?? undefined,
    screenshotFullPage: rest.screenshotFullPage ?? undefined,
    screenshotElement: rest.screenshotElement ?? undefined,
    jiraTicketId: rest.jiraTicketId ?? undefined,
    capturedBy: rest.capturedBy ?? undefined,
  };
}

function rowToGroup(row: typeof schema.groups.$inferSelect) {
  const { workspaceId, ...rest } = row;
  return rest;
}
