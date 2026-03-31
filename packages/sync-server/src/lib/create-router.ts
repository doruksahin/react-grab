import { OpenAPIHono } from "@hono/zod-openapi";
import type { Bindings } from "../types.js";
import type { Database } from "../storage/d1-storage.js";

export function createRouter() {
  return new OpenAPIHono<{ Bindings: Bindings; Variables: { db: Database } }>({
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
