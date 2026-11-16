import { createRoute } from "@hono/zod-openapi";
import { createRouter } from "../lib/create-router.js";
import { REFUSAL_MESSAGES } from "../services/ticket-lock.service.js";
import {
  WorkspaceIdParam,
  GroupIdParam,
  StatusResponse,
  ErrorResponse,
  SelectionGroup,
  SelectionGroupArray,
  SelectionGroupWrite,
} from "../schemas/index.js";
import { ARCHIVE_REFUSAL_MESSAGES } from "../services/group-archive.service.js";

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
    409: {
      description: "Refused: the group has a Jira ticket (ADR-0008)",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

/** Takes a ticketed group off the board (ADR-0030); the server sets the time. */
const archiveGroupRoute = createRoute({
  method: "put",
  path: "/workspaces/{id}/groups/{groupId}/archive",
  tags: ["groups"],
  summary: "Archive one group that has a Jira ticket",
  operationId: "archiveGroup",
  request: { params: GroupIdParam },
  responses: {
    200: {
      description: "The group as it is now",
      content: { "application/json": { schema: SelectionGroup } },
    },
    404: {
      description: "The group does not exist",
      content: { "application/json": { schema: ErrorResponse } },
    },
    409: {
      description:
        "Refused: the group has no Jira ticket; delete it instead (ADR-0030)",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

/** Brings an archived group back to the board (ADR-0030). */
const restoreGroupRoute = createRoute({
  method: "delete",
  path: "/workspaces/{id}/groups/{groupId}/archive",
  tags: ["groups"],
  summary: "Restore one archived group",
  operationId: "restoreGroup",
  request: { params: GroupIdParam },
  responses: {
    200: {
      description: "The group as it is now",
      content: { "application/json": { schema: SelectionGroup } },
    },
    404: {
      description: "The group does not exist",
      content: { "application/json": { schema: ErrorResponse } },
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
    const result = await c.var.ticketLock.deleteGroup(id, groupId);
    if (result.status === "refused") {
      return c.json({ error: REFUSAL_MESSAGES[result.reason] }, 409);
    }
    return c.json({ status: "ok" as const }, 200);
  })
  .openapi(archiveGroupRoute, async (c) => {
    const { id, groupId } = c.req.valid("param");
    const result = await c.var.groupArchive.archive(id, groupId);
    if (result.status === "refused") {
      const message = ARCHIVE_REFUSAL_MESSAGES[result.reason];
      return result.reason === "group-not-found"
        ? c.json({ error: message }, 404)
        : c.json({ error: message }, 409);
    }
    return c.json(result.group, 200);
  })
  .openapi(restoreGroupRoute, async (c) => {
    const { id, groupId } = c.req.valid("param");
    const result = await c.var.groupArchive.restore(id, groupId);
    if (result.status === "refused") {
      return c.json({ error: ARCHIVE_REFUSAL_MESSAGES[result.reason] }, 404);
    }
    return c.json(result.group, 200);
  });
