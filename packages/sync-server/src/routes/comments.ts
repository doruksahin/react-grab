import { createRoute } from "@hono/zod-openapi";
import { createRouter } from "../lib/create-router.js";
import {
  WorkspaceIdParam,
  CommentIdParam,
  StatusResponse,
  ErrorResponse,
  CommentItem,
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

/**
 * Writes one comment. Each comment is its own resource so a client can only
 * replace what it changed — see ADR-0019 for why the old "replace every
 * comment in the workspace" route was removed.
 */
const upsertCommentRoute = createRoute({
  method: "put",
  path: "/workspaces/{id}/comments/{commentId}",
  tags: ["comments"],
  summary: "Create or replace one comment",
  operationId: "upsertComment",
  request: {
    params: CommentIdParam,
    body: {
      content: {
        "application/json": {
          schema: CommentItem,
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

const deleteCommentRoute = createRoute({
  method: "delete",
  path: "/workspaces/{id}/comments/{commentId}",
  tags: ["comments"],
  summary: "Delete one comment",
  operationId: "deleteComment",
  request: {
    params: CommentIdParam,
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

export const commentsRoutes = createRouter()
  .openapi(listCommentsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const comments = await c.var.repo.listComments(id);
    return c.json(comments, 200);
  })
  .openapi(upsertCommentRoute, async (c) => {
    const { id, commentId } = c.req.valid("param");
    const body = c.req.valid("json");
    if (body.id !== commentId) {
      return c.json(
        { error: "Body id must match the commentId in the path" },
        400,
      );
    }
    await c.var.repo.upsertComment(id, body);
    return c.json({ status: "ok" as const }, 200);
  })
  .openapi(deleteCommentRoute, async (c) => {
    const { id, commentId } = c.req.valid("param");
    await c.var.repo.deleteComment(id, commentId);
    return c.json({ status: "ok" as const }, 200);
  });
