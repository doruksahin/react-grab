import { Hono } from "hono";
import { readJsonFile, writeJsonFile } from "../storage/file-storage.js";

const GROUPS_FILE = "groups.json";

export const groupsRoutes = new Hono()
  .get("/workspaces/:id/groups", async (c) => {
    const workspaceId = c.req.param("id");
    const groups = await readJsonFile(workspaceId, GROUPS_FILE, []);
    return c.json(groups);
  })
  .put("/workspaces/:id/groups", async (c) => {
    const workspaceId = c.req.param("id");
    const body = await c.req.json();
    if (!Array.isArray(body)) {
      return c.json({ error: "Body must be an array" }, 400);
    }
    await writeJsonFile(workspaceId, GROUPS_FILE, body);
    return c.json({ status: "ok" });
  });
