import { Hono } from "hono";
import { readJsonFile, writeJsonFile } from "../storage/file-storage.js";

const COMMENTS_FILE = "comments.json";

export const commentsRoutes = new Hono()
  .get("/workspaces/:id/comments", async (c) => {
    const workspaceId = c.req.param("id");
    const comments = await readJsonFile(workspaceId, COMMENTS_FILE, []);
    return c.json(comments);
  })
  .put("/workspaces/:id/comments", async (c) => {
    const workspaceId = c.req.param("id");
    const body = await c.req.json();
    if (!Array.isArray(body)) {
      return c.json({ error: "Body must be an array" }, 400);
    }
    await writeJsonFile(workspaceId, COMMENTS_FILE, body);
    return c.json({ status: "ok" });
  });
