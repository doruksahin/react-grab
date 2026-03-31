import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

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

export const healthRoutes = new OpenAPIHono().openapi(healthRoute, (c) => {
  return c.json({ status: "ok" as const }, 200);
});
