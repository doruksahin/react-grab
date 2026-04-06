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

export const JiraTicketStatus = z.object({
  status: z.string(),
  statusCategory: z.string(),
  assignee: z.string().nullable(),
  reporter: z.string().nullable(),
  jiraUrl: z.string(),
});

export const GroupIdParam = z.object({
  id: z.string().openapi({ description: "Workspace ID" }),
  groupId: z.string().openapi({ description: "Group ID" }),
});
