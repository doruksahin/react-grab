import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  groupId: text("group_id").notNull(),
  content: text("content").notNull(),
  elementName: text("element_name").notNull(),
  tagName: text("tag_name").notNull(),
  componentName: text("component_name"),
  elementsCount: integer("elements_count"),
  elementSelectors: text("element_selectors", { mode: "json" }).$type<string[]>(),
  commentText: text("comment_text"),
  timestamp: real("timestamp").notNull(),
  revealed: integer("revealed", { mode: "boolean" }).notNull(),
  status: text("status", { enum: ["open", "ticketed", "resolved"] }),
  pageUrl: text("page_url"),
  pageTitle: text("page_title"),
  screenshotFullPage: text("screenshot_full_page"),
  screenshotElement: text("screenshot_element"),
  jiraTicketId: text("jira_ticket_id"),
  capturedBy: text("captured_by"),
});

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  createdAt: real("created_at").notNull(),
  revealed: integer("revealed", { mode: "boolean" }).notNull(),
});

export type CommentInsert = typeof comments.$inferInsert;
export type GroupInsert = typeof groups.$inferInsert;
