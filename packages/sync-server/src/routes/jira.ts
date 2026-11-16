import { createRoute, z } from "@hono/zod-openapi";
import { createRouter } from "../lib/create-router.js";
import { jiraErrorResponses } from "../lib/jira-error-responses.js";
import {
  CreateJiraTicketRequest,
  CreateJiraTicketResponse,
  AddJiraCommentRequest,
  AddJiraCommentResponse,
  JiraUser,
  JiraProject,
  JiraSite,
  JiraIssueType,
  JiraPriority,
  JiraTicketStatus,
  GroupIdParam,
  WorkspaceIdParam,
  LegacyProjectKeyQuery,
} from "../schemas/index.js";
import {
  JiraError,
  toJiraError,
  withJiraErrors,
} from "../services/jira-errors.js";
import type { JiraAccountClient } from "../services/jira-client-factory.js";

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
  request: { params: WorkspaceIdParam, query: LegacyProjectKeyQuery },
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
  request: { params: WorkspaceIdParam, query: LegacyProjectKeyQuery },
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
  request: { params: WorkspaceIdParam, query: LegacyProjectKeyQuery },
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
    query: LegacyProjectKeyQuery.extend({
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

// ── Deprecated: the environment account (ADR-0018), removed at the cut-over ──

const legacySite = createRoute({
  method: "get",
  path: "/jira/site",
  tags: ["jira"],
  summary: "Deprecated: the environment account's Jira site",
  operationId: "getLegacyJiraSite",
  deprecated: true,
  responses: {
    200: {
      description: "The environment account's site",
      content: { "application/json": { schema: JiraSite } },
    },
    ...jiraErrorResponses,
  },
});

const legacyProjects = createRoute({
  method: "get",
  path: "/jira/projects",
  tags: ["jira"],
  summary: "Deprecated: projects of the environment account",
  operationId: "listLegacyJiraProjects",
  deprecated: true,
  responses: {
    200: {
      description: "Projects",
      content: { "application/json": { schema: z.array(JiraProject) } },
    },
    ...jiraErrorResponses,
  },
});

const legacyProjectQuery = z.object({
  projectKey: z.string().openapi({ example: "ATT" }),
});

const legacyIssueTypes = createRoute({
  method: "get",
  path: "/jira/issue-types",
  tags: ["jira"],
  summary: "Deprecated: issue types through the environment account",
  operationId: "listLegacyJiraIssueTypes",
  deprecated: true,
  request: { query: legacyProjectQuery },
  responses: {
    200: {
      description: "Issue types",
      content: { "application/json": { schema: z.array(JiraIssueType) } },
    },
    ...jiraErrorResponses,
  },
});

const legacyPriorities = createRoute({
  method: "get",
  path: "/jira/priorities",
  tags: ["jira"],
  summary: "Deprecated: priorities through the environment account",
  operationId: "listLegacyJiraPriorities",
  deprecated: true,
  responses: {
    200: {
      description: "Priorities",
      content: { "application/json": { schema: z.array(JiraPriority) } },
    },
    ...jiraErrorResponses,
  },
});

const legacyLabels = createRoute({
  method: "get",
  path: "/jira/labels",
  tags: ["jira"],
  summary: "Deprecated: labels through the environment account",
  operationId: "listLegacyJiraLabels",
  deprecated: true,
  request: { query: legacyProjectQuery },
  responses: {
    200: {
      description: "Label strings",
      content: { "application/json": { schema: z.array(z.string()) } },
    },
    ...jiraErrorResponses,
  },
});

const legacyUsers = createRoute({
  method: "get",
  path: "/jira/users",
  tags: ["jira"],
  summary: "Deprecated: user search through the environment account",
  operationId: "searchLegacyJiraUsers",
  deprecated: true,
  request: {
    query: z.object({
      query: z.string(),
      project: z.string().optional(),
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

/** The environment account for the deprecated routes; gone once it is removed. */
const environmentAccount = (
  client: JiraAccountClient | null,
): JiraAccountClient => {
  if (client) return client;
  throw new JiraError(
    "jira-destination-missing",
    "The environment Jira account is removed; use the workspace routes",
  );
};

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
    const { projectKey } = c.req.valid("query");
    return c.json(await c.var.jiraTickets.listIssueTypes(id, projectKey), 200);
  })
  .openapi(listPriorities, async (c) => {
    const { id } = c.req.valid("param");
    const { projectKey } = c.req.valid("query");
    return c.json(await c.var.jiraTickets.listPriorities(id, projectKey), 200);
  })
  .openapi(listLabels, async (c) => {
    const { id } = c.req.valid("param");
    const { projectKey } = c.req.valid("query");
    return c.json(await c.var.jiraTickets.listLabels(id, projectKey), 200);
  })
  .openapi(searchUsers, async (c) => {
    const { id } = c.req.valid("param");
    const { query, projectKey } = c.req.valid("query");
    return c.json(
      await c.var.jiraTickets.searchUsers(id, query, projectKey),
      200,
    );
  })
  .openapi(legacySite, (c) =>
    c.json(
      {
        siteUrl: environmentAccount(c.var.jiraClients.forEnvironment()).siteUrl,
      },
      200,
    ),
  )
  .openapi(legacyProjects, async (c) => {
    const { jira } = environmentAccount(c.var.jiraClients.forEnvironment());
    return c.json(
      await withJiraErrors(
        () => jira.getProjects(),
        "Failed to list Jira projects",
      ),
      200,
    );
  })
  .openapi(legacyIssueTypes, async (c) => {
    const { projectKey } = c.req.valid("query");
    const { jira } = environmentAccount(c.var.jiraClients.forEnvironment());
    return c.json(
      await withJiraErrors(
        () => jira.getIssueTypes(projectKey),
        "Failed to list Jira issue types",
      ),
      200,
    );
  })
  .openapi(legacyPriorities, async (c) => {
    const { jira } = environmentAccount(c.var.jiraClients.forEnvironment());
    return c.json(
      await withJiraErrors(
        () => jira.getPriorities(),
        "Failed to list Jira priorities",
      ),
      200,
    );
  })
  .openapi(legacyLabels, async (c) => {
    const { projectKey } = c.req.valid("query");
    const { jira } = environmentAccount(c.var.jiraClients.forEnvironment());
    return c.json(
      await withJiraErrors(
        () => jira.getLabels(projectKey),
        "Failed to list Jira labels",
      ),
      200,
    );
  })
  .openapi(legacyUsers, async (c) => {
    const { query, project } = c.req.valid("query");
    const { jira } = environmentAccount(c.var.jiraClients.forEnvironment());
    return c.json(
      await withJiraErrors(
        () => jira.searchUsers(query, project),
        "Failed to search Jira users",
      ),
      200,
    );
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
