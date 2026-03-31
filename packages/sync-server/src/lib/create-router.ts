import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../types.js";

export function createRouter() {
  return new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          { error: result.error.issues.map((i) => i.message).join(", ") },
          400,
        );
      }
    },
  });
}
