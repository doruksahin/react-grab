import { SELF, env } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../db/schema.js";
import { D1SyncRepository } from "../../repositories/d1.repo.js";
import { authorized } from "../../test/api-token.js";

/**
 * The HTTP contract from ADR-0019, exercised through the deployed Worker's
 * own entry point. Every request carries the API token (ADR-0020). No request
 * here reaches Jira.
 */

// Storage is isolated per file, not per test: one workspace per test.
let WORKSPACE: string;
let BASE: string;

beforeEach(() => {
  WORKSPACE = `ws-${crypto.randomUUID()}`;
  BASE = `https://sync.test/workspaces/${WORKSPACE}`;
});

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: authorized({ "content-type": "application/json" }),
  body: JSON.stringify(body),
});

const get = (url: string) => SELF.fetch(url, { headers: authorized() });

const sampleComment = {
  id: "c-1",
  groupId: "g-1",
  content: "<div>x</div>",
  elementName: "Card",
  tagName: "div",
  timestamp: 1,
};

describe("per-item routes", () => {
  it("writes one comment at its own URL", async () => {
    const response = await SELF.fetch(
      `${BASE}/comments/c-1`,
      json("PUT", sampleComment),
    );
    expect(response.status).toBe(200);

    const listed = await get(`${BASE}/comments`);
    expect(await listed.json()).toHaveLength(1);
  });

  it("rejects a body whose id does not match the URL", async () => {
    const response = await SELF.fetch(
      `${BASE}/comments/c-1`,
      json("PUT", { ...sampleComment, id: "c-2" }),
    );
    expect(response.status).toBe(400);
  });

  it("deletes one comment", async () => {
    await SELF.fetch(`${BASE}/comments/c-1`, json("PUT", sampleComment));
    const response = await SELF.fetch(`${BASE}/comments/c-1`, {
      method: "DELETE",
      headers: authorized(),
    });
    expect(response.status).toBe(200);

    const listed = await get(`${BASE}/comments`);
    expect(await listed.json()).toEqual([]);
  });

  it("no longer accepts a whole-list write", async () => {
    const comments = await SELF.fetch(
      `${BASE}/comments`,
      json("PUT", [sampleComment]),
    );
    const groups = await SELF.fetch(`${BASE}/groups`, json("PUT", []));
    expect(comments.status).toBe(404);
    expect(groups.status).toBe(404);
  });

  it("ignores ticket fields a client sends in a group write", async () => {
    const repo = new D1SyncRepository(drizzle(env.DB, { schema }));
    await repo.upsertGroup(WORKSPACE, { id: "g-1", name: "G", createdAt: 1 });
    await repo.updateGroupJira(WORKSPACE, "g-1", "UI-128");

    const response = await SELF.fetch(
      `${BASE}/groups/g-1`,
      json("PUT", {
        id: "g-1",
        name: "G",
        createdAt: 1,
        jiraTicketId: "FORGED-1",
        status: "open",
      }),
    );
    expect(response.status).toBe(200);

    const [saved] = await repo.listGroups(WORKSPACE);
    expect(saved.jiraTicketId).toBe("UI-128");
    expect(saved.status).toBe("ticketed");
  });
});
