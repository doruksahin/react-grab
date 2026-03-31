import { createRoute, z } from "@hono/zod-openapi";
import { createRouter } from "../lib/create-router.js";

const healthResponse = z.object({
  status: z.enum(["ok"]),
});

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["health"],
  summary: "Health check",
  operationId: "healthCheck",
  responses: {
    200: {
      description: "OK",
      content: {
        "application/json": {
          schema: healthResponse,
        },
      },
    },
  },
});

export const healthRoutes = createRouter().openapi(healthRoute, (c) => {
  return c.json({ status: "ok" as const }, 200);
});
