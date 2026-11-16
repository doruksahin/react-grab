import { SELF, env } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../db/schema.js";
import { D1SyncRepository } from "../../repositories/d1.repo.js";
import { authorized } from "../../test/api-token.js";

/**
 * ADR-0008, amended 2026-11-16: a comment without a ticket can be deleted;
 * a comment whose group has a ticket cannot, and neither can that group.
 */

let WORKSPACE: string;
let BASE: string;

beforeEach(() => {
  WORKSPACE = `ws-${crypto.randomUUID()}`;
  BASE = `https://sync.test/workspaces/${WORKSPACE}`;
});

const send = (method: string, path: string, body?: unknown) =>
  SELF.fetch(`${BASE}${path}`, {
    method,
    headers: authorized({ "content-type": "application/json" }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const listedCommentIds = async (): Promise<string[]> => {
  const response = await SELF.fetch(`${BASE}/comments`, {
    headers: authorized(),
  });
  const comments: Array<{ id: string }> = await response.json();
  return comments.map((comment) => comment.id);
};

const seed = async (options: { ticketed: boolean }) => {
  await send("PUT", "/groups/g-1", {
    id: "g-1",
    name: "Checkout",
    createdAt: 1,
  });
  await send("PUT", "/comments/c-1", {
    id: "c-1",
    groupId: "g-1",
    content: "<button>Pay</button>",
    elementName: "button",
    tagName: "button",
    timestamp: 1,
  });
  if (options.ticketed) {
    // The ticket is set by the server when Jira creates it.
    const repo = new D1SyncRepository(drizzle(env.DB, { schema }));
    await repo.updateGroupJira(WORKSPACE, "g-1", "UI-1", null);
  }
};

describe("deleting comments and groups with a ticket", () => {
  it("deletes a comment whose group has no ticket", async () => {
    await seed({ ticketed: false });
    expect((await send("DELETE", "/comments/c-1")).status).toBe(200);
    expect(await listedCommentIds()).toEqual([]);
  });

  it("refuses to delete a comment whose group has a ticket", async () => {
    await seed({ ticketed: true });
    const response = await send("DELETE", "/comments/c-1");
    expect(response.status).toBe(409);
    expect(await listedCommentIds()).toEqual(["c-1"]);
  });

  it("refuses to delete a group that has a ticket", async () => {
    await seed({ ticketed: true });
    expect((await send("DELETE", "/groups/g-1")).status).toBe(409);
  });

  it("deletes a group without a ticket", async () => {
    await seed({ ticketed: false });
    expect((await send("DELETE", "/groups/g-1")).status).toBe(200);
  });

  it("treats a comment that is already gone as deleted", async () => {
    expect((await send("DELETE", "/comments/missing")).status).toBe(200);
  });

  it("refuses to move a comment out of a group with a ticket", async () => {
    await seed({ ticketed: true });
    await send("PUT", "/groups/g-2", {
      id: "g-2",
      name: "Other",
      createdAt: 2,
    });
    const moved = await send("PUT", "/comments/c-1", {
      id: "c-1",
      groupId: "g-2",
      content: "<button>Pay</button>",
      elementName: "button",
      tagName: "button",
      timestamp: 1,
    });
    expect(moved.status).toBe(409);
    // So the move-then-delete path cannot remove it either.
    expect((await send("DELETE", "/comments/c-1")).status).toBe(409);
    expect(await listedCommentIds()).toEqual(["c-1"]);
  });

  it("refuses a new comment in a group with a ticket", async () => {
    await seed({ ticketed: true });
    const created = await send("PUT", "/comments/c-2", {
      id: "c-2",
      groupId: "g-1",
      content: "<a>Docs</a>",
      elementName: "a",
      tagName: "a",
      timestamp: 2,
    });
    expect(created.status).toBe(409);
  });

  it("still updates a ticketed comment that stays in its group", async () => {
    await seed({ ticketed: true });
    const updated = await send("PUT", "/comments/c-1", {
      id: "c-1",
      groupId: "g-1",
      content: "<button>Pay</button>",
      elementName: "button",
      tagName: "button",
      timestamp: 1,
      revealed: true,
    });
    expect(updated.status).toBe(200);
  });
});
