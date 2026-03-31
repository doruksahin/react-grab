import { createRoute, z } from "@hono/zod-openapi";
import { createRouter } from "../lib/create-router.js";

const ScreenshotParams = z.object({
  id: z.string().openapi({ description: "Workspace ID" }),
  selectionId: z.string().openapi({ description: "Selection/comment ID" }),
  type: z.enum(["full", "element"]).openapi({ description: "Screenshot type" }),
});

const uploadScreenshot = createRoute({
  method: "put",
  path: "/workspaces/{id}/screenshots/{selectionId}/{type}",
  tags: ["screenshots"],
  summary: "Upload a screenshot",
  operationId: "uploadScreenshot",
  request: {
    params: ScreenshotParams,
    body: {
      content: {
        "image/png": { schema: z.any() },
        "image/jpeg": { schema: z.any() },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Upload success",
      content: {
        "application/json": {
          schema: z.object({ key: z.string() }),
        },
      },
    },
  },
});

const getScreenshot = createRoute({
  method: "get",
  path: "/workspaces/{id}/screenshots/{selectionId}/{type}",
  tags: ["screenshots"],
  summary: "Get a screenshot",
  operationId: "getScreenshot",
  request: {
    params: ScreenshotParams,
  },
  responses: {
    200: { description: "Screenshot image" },
    404: { description: "Not found" },
  },
});

export const screenshotsRoutes = createRouter()
  .openapi(uploadScreenshot, async (c) => {
    const { id, selectionId, type } = c.req.valid("param");
    const contentType = c.req.header("Content-Type") ?? "image/png";
    const extension = contentType.includes("jpeg") ? "jpg" : "png";
    const key = `${id}/screenshots/${selectionId}/${type}.${extension}`;

    const body = await c.req.arrayBuffer();
    await c.env.BUCKET.put(key, body, {
      httpMetadata: { contentType },
    });

    return c.json({ key }, 200);
  })
  .openapi(getScreenshot, async (c) => {
    const { id, selectionId, type } = c.req.valid("param");

    // Try both extensions
    for (const ext of ["png", "jpg"]) {
      const key = `${id}/screenshots/${selectionId}/${type}.${ext}`;
      const object = await c.env.BUCKET.get(key);
      if (object) {
        const headers = new Headers();
        headers.set("Content-Type", object.httpMetadata?.contentType ?? "image/png");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        return new Response(object.body, { headers });
      }
    }

    return c.json({ error: "Screenshot not found" }, 404);
  });
