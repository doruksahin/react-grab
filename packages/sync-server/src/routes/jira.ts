import { createRoute, z } from "@hono/zod-openapi";
import { createRouter } from "../lib/create-router.js";
import { jiraErrorResponses } from "../lib/jira-error-responses.js";
import {
  CreateJiraTicketRequest,
  CreateJiraTicketResponse,
  AddJiraCommentRequest,
  AddJiraCommentResponse,
  JiraUser,
  JiraMe,
  JiraIssueType,
  JiraPriority,
  JiraTicketStatus,
  GroupIdParam,
  WorkspaceIdParam,
} from "../schemas/index.js";
import { toJiraError } from "../services/jira-errors.js";

// ── A group's ticket: created through the workspace's destination, read
//    and commented on through the account that created it (ADR-0027). ──

const createTicket = createRoute({
  method: "post",
  path: "/workspaces/{id}/groups/{groupId}/jira-ticket",
  tags: ["jira"],
  summary: "Create a Jira ticket from a group, in the workspace's destination",
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
    ...jiraErrorResponses,
  },
});

const getTicketStatus = createRoute({
  method: "get",
  path: "/workspaces/{id}/groups/{groupId}/jira-status",
  tags: ["jira"],
  summary: "Get the Jira ticket status for a group",
  operationId: "getJiraTicketStatus",
  request: { params: GroupIdParam },
  responses: {
    200: {
      description: "Ticket status",
      content: { "application/json": { schema: JiraTicketStatus } },
    },
    ...jiraErrorResponses,
  },
});

const addComment = createRoute({
  method: "post",
  path: "/workspaces/{id}/groups/{groupId}/jira-comment",
  tags: ["jira"],
  summary: "Add a comment to the Jira ticket linked to a group",
  operationId: "addJiraComment",
  request: {
    params: GroupIdParam,
    body: {
      content: { "application/json": { schema: AddJiraCommentRequest } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Comment created",
      content: { "application/json": { schema: AddJiraCommentResponse } },
    },
    ...jiraErrorResponses,
  },
});

// ── Pickers: the workspace's destination decides the account and project ──

const listIssueTypes = createRoute({
  method: "get",
  path: "/workspaces/{id}/jira/issue-types",
  tags: ["jira"],
  summary: "Issue types of the workspace's Jira project",
  operationId: "listJiraIssueTypes",
  request: { params: WorkspaceIdParam },
  responses: {
    200: {
      description: "Issue types",
      content: { "application/json": { schema: z.array(JiraIssueType) } },
    },
    ...jiraErrorResponses,
  },
});

const listPriorities = createRoute({
  method: "get",
  path: "/workspaces/{id}/jira/priorities",
  tags: ["jira"],
  summary: "Priorities on the workspace's Jira site",
  operationId: "listJiraPriorities",
  request: { params: WorkspaceIdParam },
  responses: {
    200: {
      description: "Priorities",
      content: { "application/json": { schema: z.array(JiraPriority) } },
    },
    ...jiraErrorResponses,
  },
});

const listLabels = createRoute({
  method: "get",
  path: "/workspaces/{id}/jira/labels",
  tags: ["jira"],
  summary: "Labels used in the workspace's Jira project",
  operationId: "listJiraLabels",
  request: { params: WorkspaceIdParam },
  responses: {
    200: {
      description: "Label strings",
      content: { "application/json": { schema: z.array(z.string()) } },
    },
    ...jiraErrorResponses,
  },
});

const searchUsers = createRoute({
  method: "get",
  path: "/workspaces/{id}/jira/users",
  tags: ["jira"],
  summary: "Search assignable users in the workspace's Jira project",
  operationId: "searchJiraUsers",
  request: {
    params: WorkspaceIdParam,
    query: z.object({
      query: z.string().openapi({
        description: "Search query for user name/email",
        example: "salih",
      }),
    }),
  },
  responses: {
    200: {
      description: "Matching users",
      content: { "application/json": { schema: z.array(JiraUser) } },
    },
    ...jiraErrorResponses,
  },
});

const getJiraMe = createRoute({
  method: "get",
  path: "/workspaces/{id}/jira/me",
  tags: ["jira"],
  summary: "Who the request's Jira credential signs in as",
  description:
    "The caller's personal credential (X-Jira-Credential) when it sends one, else the workspace's account (ADR-0031)",
  operationId: "getJiraMe",
  request: { params: WorkspaceIdParam },
  responses: {
    200: {
      description: "The Jira user",
      content: { "application/json": { schema: JiraMe } },
    },
    ...jiraErrorResponses,
  },
});

export const jiraRoutes = createRouter()
  .openapi(createTicket, async (c) => {
    const { id, groupId } = c.req.valid("param");
    return c.json(
      await c.var.jiraTickets.createTicket(id, groupId, c.req.valid("json")),
      200,
    );
  })
  .openapi(getTicketStatus, async (c) => {
    const { id, groupId } = c.req.valid("param");
    return c.json(await c.var.jiraTickets.getStatus(id, groupId), 200);
  })
  .openapi(addComment, async (c) => {
    const { id, groupId } = c.req.valid("param");
    return c.json(
      await c.var.jiraTickets.addComment(id, groupId, c.req.valid("json")),
      200,
    );
  })
  .openapi(listIssueTypes, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await c.var.jiraTickets.listIssueTypes(id), 200);
  })
  .openapi(listPriorities, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await c.var.jiraTickets.listPriorities(id), 200);
  })
  .openapi(listLabels, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await c.var.jiraTickets.listLabels(id), 200);
  })
  .openapi(searchUsers, async (c) => {
    const { id } = c.req.valid("param");
    const { query } = c.req.valid("query");
    return c.json(await c.var.jiraTickets.searchUsers(id, query), 200);
  })
  .openapi(getJiraMe, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await c.var.jiraTickets.whoAmI(id), 200);
  });

// A ticket attachment, streamed through the ticket's own account so the
// account's token never reaches the browser (ADR-0027).
jiraRoutes.get(
  "/workspaces/:id/groups/:groupId/jira-attachments/:attachmentId",
  async (c) => {
    const upstream = await c.var.jiraTickets.fetchAttachment(
      c.req.param("id"),
      c.req.param("groupId"),
      c.req.param("attachmentId"),
    );
    if (!upstream.ok || !upstream.body) {
      throw toJiraError(
        { status: upstream.status },
        "Failed to load the Jira attachment",
      );
    }
    const headers = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    headers.set("cache-control", "private, max-age=3600");
    return new Response(upstream.body, { status: 200, headers });
  },
);
