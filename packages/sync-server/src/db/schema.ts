import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { ReproduceStepValue } from "../schemas/reproduce-step.js";

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    groupId: text("group_id").notNull(),
    content: text("content").notNull(),
    elementName: text("element_name").notNull(),
    tagName: text("tag_name").notNull(),
    componentName: text("component_name"),
    elementsCount: integer("elements_count"),
    elementSelectors: text("element_selectors", { mode: "json" }).$type<
      string[]
    >(),
    commentText: text("comment_text"),
    timestamp: real("timestamp").notNull(),
    revealed: integer("revealed", { mode: "boolean" }),
    status: text("status", { enum: ["open", "ticketed", "resolved"] }),
    pageUrl: text("page_url"),
    pageTitle: text("page_title"),
    screenshotFullPage: text("screenshot_full_page"),
    screenshotElement: text("screenshot_element"),
    recordingUrl: text("recording_url"),
    steps: text("steps", { mode: "json" }).$type<ReproduceStepValue[]>(),
    jiraTicketId: text("jira_ticket_id"),
    capturedBy: text("captured_by"),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.workspaceId] }),
    index("comments_workspace_id_idx").on(table.workspaceId),
  ],
);

export const groups = sqliteTable(
  "groups",
  {
    id: text("id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    name: text("name").notNull(),
    createdAt: real("created_at").notNull(),
    revealed: integer("revealed", { mode: "boolean" }),
    status: text("status", { enum: ["open", "ticketed", "resolved"] }),
    jiraTicketId: text("jira_ticket_id"),
    /** The account that created the ticket; it reads the ticket ever after (ADR-0027). */
    jiraAccountId: text("jira_account_id").references(() => jiraAccounts.id, {
      onDelete: "restrict",
    }),
    synthetic: integer("synthetic", { mode: "boolean" }),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.workspaceId] }),
    index("groups_workspace_id_idx").on(table.workspaceId),
  ],
);

/** A Jira account entered in the settings; its credential only ever encrypted (ADR-0027). */
export const jiraAccounts = sqliteTable(
  "jira_accounts",
  {
    id: text("id").primaryKey(),
    siteUrl: text("site_url").notNull(),
    email: text("email").notNull(),
    atlassianAccountId: text("atlassian_account_id").notNull(),
    displayName: text("display_name").notNull(),
    credentialKind: text("credential_kind", { enum: ["api-token"] }).notNull(),
    credentialCiphertext: text("credential_ciphertext").notNull(),
    credentialIv: text("credential_iv").notNull(),
    keyVersion: text("key_version").notNull(),
    createdAt: real("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("jira_accounts_site_user_idx").on(
      table.siteUrl,
      table.atlassianAccountId,
    ),
  ],
);

/** A workspace and where its new Jira tickets go (ADR-0027). */
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  jiraAccountId: text("jira_account_id").references(() => jiraAccounts.id, {
    onDelete: "restrict",
  }),
  jiraProjectKey: text("jira_project_key"),
  createdAt: real("created_at").notNull(),
});

export type CommentInsert = typeof comments.$inferInsert;
export type GroupInsert = typeof groups.$inferInsert;
