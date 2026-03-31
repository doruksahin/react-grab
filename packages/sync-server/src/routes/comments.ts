import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { readJsonFile, writeJsonFile } from "../storage/file-storage.js";
import {
  WorkspaceIdParam,
  StatusResponse,
  ErrorResponse,
  CommentItemArray,
} from "../schemas/index.js";

const COMMENTS_FILE = "comments.json";

const listComments = createRoute({
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

const persistComments = createRoute({
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

export const commentsRoutes = new OpenAPIHono()
  .openapi(listComments, async (c) => {
    const { id } = c.req.valid("param");
    const comments = await readJsonFile(id, COMMENTS_FILE, []);
    return c.json(comments, 200);
  })
  .openapi(persistComments, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    await writeJsonFile(id, COMMENTS_FILE, body);
    return c.json({ status: "ok" as const }, 200);
  });
