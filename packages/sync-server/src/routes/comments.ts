import { createRoute } from "@hono/zod-openapi";
import { createRouter } from "../lib/create-router.js";
import {
  WorkspaceIdParam,
  StatusResponse,
  ErrorResponse,
  CommentItemArray,
} from "../schemas/index.js";

const listCommentsRoute = createRoute({
  method: "get",
  path: "/workspaces/{id}/comments",
  tags: ["comments"],
  summary: "List all comments in a workspace",
  operationId: "listComments",
  request: {
    params: WorkspaceIdParam,
  },
  responses: {
    200: {
      description: "Array of comments",
      content: {
        "application/json": {
          schema: CommentItemArray,
        },
      },
    },
  },
});

const persistCommentsRoute = createRoute({
  method: "put",
  path: "/workspaces/{id}/comments",
  tags: ["comments"],
  summary: "Replace all comments in a workspace",
  operationId: "persistComments",
  request: {
    params: WorkspaceIdParam,
    body: {
      content: {
        "application/json": {
          schema: CommentItemArray,
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

export const commentsRoutes = createRouter()
  .openapi(listCommentsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const comments = await c.var.repo.listComments(id);
    return c.json(comments, 200);
  })
  .openapi(persistCommentsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    await c.var.repo.persistComments(id, body);
    return c.json({ status: "ok" as const }, 200);
  });
