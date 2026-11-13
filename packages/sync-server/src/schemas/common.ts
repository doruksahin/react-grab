import { z } from "@hono/zod-openapi";

export const WorkspaceIdParam = z.object({
  id: z
    .string()
    .openapi({ description: "Workspace ID", example: "my-workspace" }),
});

export const CommentIdParam = z.object({
  id: z.string().openapi({ description: "Workspace ID" }),
  commentId: z.string().openapi({ description: "Comment ID" }),
});

export const StatusResponse = z.object({
  status: z.enum(["ok"]).openapi({ example: "ok" }),
});

export const ErrorResponse = z.object({
  error: z.string().openapi({ example: "Body must be an array" }),
});
