import { createRoute } from "@hono/zod-openapi";
import { createRouter } from "../lib/create-router.js";
import { listGroups, persistGroups } from "../storage/d1-storage.js";
import {
  WorkspaceIdParam,
  StatusResponse,
  ErrorResponse,
  SelectionGroupArray,
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

const persistGroupsRoute = createRoute({
  method: "put",
  path: "/workspaces/{id}/groups",
  tags: ["groups"],
  summary: "Replace all groups in a workspace",
  operationId: "persistGroups",
  request: {
    params: WorkspaceIdParam,
    body: {
      content: {
        "application/json": {
          schema: SelectionGroupArray,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Success",
      content: {
        "application/json": {
          schema: StatusResponse,
        },
      },
    },
    400: {
      description: "Invalid body",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

export const groupsRoutes = createRouter()
  .openapi(listGroupsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const db = c.get("db");
    const groups = await listGroups(db, id);
    return c.json(groups, 200);
  })
  .openapi(persistGroupsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");
    await persistGroups(db, id, body);
    return c.json({ status: "ok" as const }, 200);
  });
