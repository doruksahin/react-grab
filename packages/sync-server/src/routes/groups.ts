import { createRoute } from "@hono/zod-openapi";
import { createRouter } from "../lib/create-router.js";
import {
  WorkspaceIdParam,
  GroupIdParam,
  StatusResponse,
  ErrorResponse,
  SelectionGroupArray,
  SelectionGroupWrite,
} from "../schemas/index.js";

const listGroupsRoute = createRoute({
  method: "get",
  path: "/workspaces/{id}/groups",
  tags: ["groups"],
  summary: "List all groups in a workspace",
  operationId: "listGroups",
  request: {
    params: WorkspaceIdParam,
  },
  responses: {
    200: {
      description: "Array of groups",
      content: {
        "application/json": {
          schema: SelectionGroupArray,
        },
      },
    },
  },
});

/**
 * Writes one group's client-owned fields. `status` and `jiraTicketId` are not
 * part of the body: the server sets them when it creates the Jira ticket, and
 * a client that has not seen that ticket must not be able to erase it
 * (ADR-0019).
 */
const upsertGroupRoute = createRoute({
  method: "put",
  path: "/workspaces/{id}/groups/{groupId}",
  tags: ["groups"],
  summary: "Create or replace one group",
  operationId: "upsertGroup",
  request: {
    params: GroupIdParam,
    body: {
      content: {
        "application/json": {
          schema: SelectionGroupWrite,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Saved",
      content: {
        "application/json": {
          schema: StatusResponse,
        },
      },
    },
    400: {
      description: "Invalid body, or the body's id does not match the path",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

const deleteGroupRoute = createRoute({
  method: "delete",
  path: "/workspaces/{id}/groups/{groupId}",
  tags: ["groups"],
  summary: "Delete one group",
  operationId: "deleteGroup",
  request: {
    params: GroupIdParam,
  },
  responses: {
    200: {
      description: "Deleted, or already absent",
      content: {
        "application/json": {
          schema: StatusResponse,
        },
      },
    },
  },
});

export const groupsRoutes = createRouter()
  .openapi(listGroupsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const groups = await c.var.repo.listGroups(id);
    return c.json(groups, 200);
  })
  .openapi(upsertGroupRoute, async (c) => {
    const { id, groupId } = c.req.valid("param");
    const body = c.req.valid("json");
    if (body.id !== groupId) {
      return c.json(
        { error: "Body id must match the groupId in the path" },
        400,
      );
    }
    await c.var.repo.upsertGroup(id, body);
    return c.json({ status: "ok" as const }, 200);
  })
  .openapi(deleteGroupRoute, async (c) => {
    const { id, groupId } = c.req.valid("param");
    await c.var.repo.deleteGroup(id, groupId);
    return c.json({ status: "ok" as const }, 200);
  });
