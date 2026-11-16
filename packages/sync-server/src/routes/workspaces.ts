import { createRoute, z } from "@hono/zod-openapi";
import { createRouter } from "../lib/create-router.js";
import { jiraErrorResponses } from "../lib/jira-error-responses.js";
import {
  JiraDestination,
  SetJiraDestinationRequest,
  WorkspaceIdParam,
  WorkspaceSummary,
} from "../schemas/index.js";

/*
 * Workspaces and their Jira destination (ADR-0027). Reading needs the sync
 * token; setting or clearing a destination needs the admin token
 * (`requireAdminToken` in app.ts).
 */

const listWorkspaces = createRoute({
  method: "get",
  path: "/workspaces",
  tags: ["workspaces"],
  summary: "List workspaces with their Jira destination",
  operationId: "listWorkspaces",
  responses: {
    200: {
      description: "Workspaces",
      content: { "application/json": { schema: z.array(WorkspaceSummary) } },
    },
  },
});

const putWorkspace = createRoute({
  method: "put",
  path: "/workspaces/{id}",
  tags: ["workspaces"],
  summary: "Create the workspace if it does not exist",
  operationId: "putWorkspace",
  request: { params: WorkspaceIdParam },
  responses: { 204: { description: "The workspace exists" } },
});

const getDestination = createRoute({
  method: "get",
  path: "/workspaces/{id}/jira",
  tags: ["workspaces"],
  summary: "Where the workspace's new Jira tickets go, and as whom",
  operationId: "getJiraDestination",
  request: { params: WorkspaceIdParam },
  responses: {
    200: {
      description: "The destination",
      content: { "application/json": { schema: JiraDestination } },
    },
    ...jiraErrorResponses,
  },
});

const setDestination = createRoute({
  method: "put",
  path: "/workspaces/{id}/jira",
  tags: ["workspaces"],
  summary: "Send the workspace's new Jira tickets to an account's project",
  operationId: "setJiraDestination",
  request: {
    params: WorkspaceIdParam,
    body: {
      content: { "application/json": { schema: SetJiraDestinationRequest } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "The new destination",
      content: { "application/json": { schema: JiraDestination } },
    },
    ...jiraErrorResponses,
  },
});

const clearDestination = createRoute({
  method: "delete",
  path: "/workspaces/{id}/jira",
  tags: ["workspaces"],
  summary: "Clear the workspace's Jira destination; tickets keep their account",
  operationId: "clearJiraDestination",
  request: { params: WorkspaceIdParam },
  responses: { 204: { description: "Cleared" } },
});

export const workspaceRoutes = createRouter()
  .openapi(listWorkspaces, async (c) =>
    c.json(await c.var.workspaces.list(), 200),
  )
  .openapi(putWorkspace, async (c) => {
    await c.var.workspaces.ensure(c.req.valid("param").id);
    return c.body(null, 204);
  })
  .openapi(getDestination, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await c.var.workspaces.getDestination(id), 200);
  })
  .openapi(setDestination, async (c) => {
    const { id } = c.req.valid("param");
    const { jiraAccountId, projectKey } = c.req.valid("json");
    return c.json(
      await c.var.workspaces.setDestination(id, jiraAccountId, projectKey),
      200,
    );
  })
  .openapi(clearDestination, async (c) => {
    await c.var.workspaces.clearDestination(c.req.valid("param").id);
    return c.body(null, 204);
  });
