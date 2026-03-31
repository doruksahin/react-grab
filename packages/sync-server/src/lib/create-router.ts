import { OpenAPIHono } from "@hono/zod-openapi";

export function createRouter() {
  return new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          { error: result.error.issues.map((i) => i.message).join(", ") },
          400
        );
      }
    },
  });
}
