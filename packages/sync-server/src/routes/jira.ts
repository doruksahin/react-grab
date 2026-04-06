import { createRoute, z } from "@hono/zod-openapi";
import { createRouter } from "../lib/create-router.js";
import {
  CreateJiraTicketRequest,
  CreateJiraTicketResponse,
  JiraProject,
  JiraIssueType,
  JiraPriority,
  JiraTicketStatus,
  GroupIdParam,
  ErrorResponse,
} from "../schemas/index.js";

const createTicket = createRoute({
  method: "post",
  path: "/workspaces/{id}/groups/{groupId}/jira-ticket",
  tags: ["jira"],
  summary: "Create a JIRA ticket from a group",
  operationId: "createJiraTicket",
  request: {
    params: GroupIdParam,
    body: {
      content: { "application/json": { schema: CreateJiraTicketRequest } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Ticket created",
      content: { "application/json": { schema: CreateJiraTicketResponse } },
    },
    400: {
      description: "Bad request",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

const getTicketStatus = createRoute({
  method: "get",
  path: "/workspaces/{id}/groups/{groupId}/jira-status",
  tags: ["jira"],
  summary: "Get JIRA ticket status for a group",
  operationId: "getJiraTicketStatus",
  request: { params: GroupIdParam },
  responses: {
    200: {
      description: "Ticket status",
      content: { "application/json": { schema: JiraTicketStatus } },
    },
    404: {
      description: "No JIRA ticket linked",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

const listProjects = createRoute({
  method: "get",
  path: "/jira/projects",
  tags: ["jira"],
  summary: "List JIRA projects",
  operationId: "listJiraProjects",
  responses: {
    200: {
      description: "List of projects",
      content: { "application/json": { schema: z.array(JiraProject) } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

const listIssueTypes = createRoute({
  method: "get",
  path: "/jira/issue-types",
  tags: ["jira"],
  summary: "List JIRA issue types for a project",
  operationId: "listJiraIssueTypes",
  request: {
    query: z.object({
      projectKey: z.string().openapi({ description: "Project key (e.g. ATT)", example: "ATT" }),
    }),
  },
  responses: {
    200: {
      description: "List of issue types for the project",
      content: { "application/json": { schema: z.array(JiraIssueType) } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

const listPriorities = createRoute({
  method: "get",
  path: "/jira/priorities",
  tags: ["jira"],
  summary: "List JIRA priorities",
  operationId: "listJiraPriorities",
  responses: {
    200: {
      description: "List of priorities",
      content: { "application/json": { schema: z.array(JiraPriority) } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

export const jiraRoutes = createRouter()
  .openapi(createTicket, async (c) => {
    const { id: workspaceId, groupId } = c.req.valid("param");
    const body = c.req.valid("json");
    try {
      const result = await c.var.jira.createTicketFromGroup(
        body,
        workspaceId,
        groupId,
        c.var.repo,
        c.var.screenshots,
      );
      return c.json(result, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create JIRA ticket";
      return c.json({ error: message }, 400);
    }
  })
  .openapi(getTicketStatus, async (c) => {
    const { id: workspaceId, groupId } = c.req.valid("param");
    const groups = await c.var.repo.listGroups(workspaceId);
    const group = groups.find((g) => g.id === groupId);
    if (!group?.jiraTicketId) {
      return c.json({ error: "No JIRA ticket linked to this group" }, 404);
    }
    const status = await c.var.jira.getIssueStatus(group.jiraTicketId);
    return c.json(status, 200);
  })
  .openapi(listProjects, async (c) => {
    try {
      const projects = await c.var.jira.getProjects();
      return c.json(projects, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list JIRA projects";
      return c.json({ error: message }, 500);
    }
  })
  .openapi(listIssueTypes, async (c) => {
    const { projectKey } = c.req.valid("query");
    try {
      const types = await c.var.jira.getIssueTypes(projectKey);
      return c.json(types, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list JIRA issue types";
      return c.json({ error: message }, 500);
    }
  })
  .openapi(listPriorities, async (c) => {
    try {
      const priorities = await c.var.jira.getPriorities();
      return c.json(priorities, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list JIRA priorities";
      return c.json({ error: message }, 500);
    }
  });
