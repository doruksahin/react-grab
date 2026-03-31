import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { swaggerUI } from "@hono/swagger-ui";
import { serve } from "@hono/node-server";
import { createRoute } from "@hono/zod-openapi";
import { readJsonFile, writeJsonFile } from "./storage/file-storage.js";
import { DOC_CONFIG } from "./lib/doc-config.js";
import { healthRoutes } from "./routes/health.js";
import {
  WorkspaceIdParam,
  StatusResponse,
  ErrorResponse,
  CommentItemArray,
  SelectionGroupArray,
} from "./schemas/index.js";

// ---- inline comments routes for Node.js mode (file-storage) ----
// TODO: These route definitions are duplicated between here and routes/comments.ts & routes/groups.ts.
// The dual-mode design (Worker = D1/R2, Node.js = file-storage) requires separate handlers,
// so the route objects could be extracted to a shared routes/route-defs.ts to avoid duplication.

const listCommentsRoute = createRoute({
  method: "get",
  path: "/workspaces/{id}/comments",
  tags: ["comments"],
  summary: "List all comments in a workspace",
  operationId: "listComments",
  request: { params: WorkspaceIdParam },
  responses: {
    200: {
      description: "Array of comments",
      content: { "application/json": { schema: CommentItemArray } },
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
      content: { "application/json": { schema: CommentItemArray } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Success",
      content: { "application/json": { schema: StatusResponse } },
    },
    400: {
      description: "Invalid body",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

const listGroupsRoute = createRoute({
  method: "get",
  path: "/workspaces/{id}/groups",
  tags: ["groups"],
  summary: "List all groups in a workspace",
  operationId: "listGroups",
  request: { params: WorkspaceIdParam },
  responses: {
    200: {
      description: "Array of groups",
      content: { "application/json": { schema: SelectionGroupArray } },
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
      content: { "application/json": { schema: SelectionGroupArray } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Success",
      content: { "application/json": { schema: StatusResponse } },
    },
    400: {
      description: "Invalid body",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

// ---- app ----

const app = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        { error: result.error.issues.map((i) => i.message).join(", ") },
        400,
      );
    }
  },
});

app.use("*", cors());
app.use("*", logger());

app.route("/", healthRoutes);

app
  .openapi(listCommentsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const comments = await readJsonFile(id, "comments.json", []);
    return c.json(comments, 200);
  })
  .openapi(persistCommentsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    await writeJsonFile(id, "comments.json", body);
    return c.json({ status: "ok" as const }, 200);
  })
  .openapi(listGroupsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const groups = await readJsonFile(id, "groups.json", []);
    return c.json(groups, 200);
  })
  .openapi(persistGroupsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    await writeJsonFile(id, "groups.json", body);
    return c.json({ status: "ok" as const }, 200);
  });

app.doc("/doc", DOC_CONFIG);
app.get("/ui", swaggerUI({ url: "/doc" }));

const PORT = parseInt(process.env.PORT ?? "3847", 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[sync-server] listening on http://localhost:${info.port}`);
  console.log(`[sync-server] Swagger UI: http://localhost:${info.port}/ui`);
  console.log(`[sync-server] OpenAPI spec: http://localhost:${info.port}/doc`);
});
