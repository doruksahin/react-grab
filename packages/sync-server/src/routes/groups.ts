import { createRoute } from "@hono/zod-openapi";
import { createRouter } from "../lib/create-router.js";
import { readJsonFile, writeJsonFile } from "../storage/file-storage.js";
import {
  WorkspaceIdParam,
  StatusResponse,
  ErrorResponse,
  SelectionGroupArray,
} from "../schemas/index.js";

const GROUPS_FILE = "groups.json";

const listGroups = createRoute({
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

const persistGroups = createRoute({
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
  .openapi(listGroups, async (c) => {
    const { id } = c.req.valid("param");
    const groups = await readJsonFile(id, GROUPS_FILE, []);
    return c.json(groups, 200);
  })
  .openapi(persistGroups, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    await writeJsonFile(id, GROUPS_FILE, body);
    return c.json({ status: "ok" as const }, 200);
  });
