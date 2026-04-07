import { z } from "@hono/zod-openapi";

export const CreateJiraTicketRequest = z.object({
  projectKey: z.string().openapi({ example: "ATT" }),
  issueType: z.string().openapi({ example: "Bug" }),
  priority: z.string().openapi({ example: "Medium" }),
  summary: z.string().openapi({ example: "CardDescription text overflow on mobile" }),
  description: z.string().openapi({ example: "The tagline text overflows on mobile viewports." }),
});

export const CreateJiraTicketResponse = z.object({
  jiraTicketId: z.string().openapi({ example: "ATT-123" }),
  jiraUrl: z.string().openapi({ example: "https://appier.atlassian.net/browse/ATT-123" }),
});

export const JiraProject = z.object({
  key: z.string(),
  name: z.string(),
});

export const JiraIssueType = z.object({
  id: z.string(),
  name: z.string(),
});

export const JiraPriority = z.object({
  id: z.string(),
  name: z.string(),
});

export const JiraComment = z.object({
  id: z.string().openapi({ example: "10001" }),
  author: z.string().openapi({ example: "Alice Cooper" }),
  authorAvatar: z.string().nullable().openapi({ example: "https://x/avatar.png" }),
  body: z.string().openapi({
    description: "Plain-text rendering of the Jira ADF comment body",
    example: "Looks good to me",
  }),
  createdAt: z.string().openapi({ example: "2026-04-07T10:00:00.000Z" }),
});

export const JiraTicketStatus = z.object({
  status: z.string(),
  statusCategory: z.string(),
  assignee: z.string().nullable(),
  reporter: z.string().nullable(),
  assigneeAvatar: z.string().nullable(),
  reporterAvatar: z.string().nullable(),
  jiraUrl: z.string(),
  labels: z.array(z.string()),
  comments: z.array(JiraComment),
});

export const GroupIdParam = z.object({
  id: z.string().openapi({ description: "Workspace ID" }),
  groupId: z.string().openapi({ description: "Group ID" }),
});
