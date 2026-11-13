import { env } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../db/schema.js";
import { D1SyncRepository } from "../d1.repo.js";
import type { Comment, GroupWrite } from "../types.js";

/**
 * Runs against real D1 inside workerd. These tests pin the behaviour ADR-0019
 * exists for: a write can only touch the item it names, and a client can
 * never overwrite the ticket fields the server owns.
 */

// D1 storage is isolated per test file, not per test, so each test works in a
// workspace of its own.
let WORKSPACE: string;

const comment = (id: string, overrides: Partial<Comment> = {}): Comment => ({
  id,
  groupId: "g-1",
  content: `<div>${id}</div>`,
  elementName: "Card",
  tagName: "div",
  commentText: `comment ${id}`,
  timestamp: 1,
  ...overrides,
});

const group = (
  id: string,
  overrides: Partial<GroupWrite> = {},
): GroupWrite => ({
  id,
  name: `Group ${id}`,
  createdAt: 1,
  ...overrides,
});

let repo: D1SyncRepository;

beforeEach(() => {
  WORKSPACE = `ws-${crypto.randomUUID()}`;
  repo = new D1SyncRepository(drizzle(env.DB, { schema }));
});

describe("comments — one item per write", () => {
  it("a stale write of one comment leaves the others untouched", async () => {
    // Tab A and tab B loaded the workspace while it was empty.
    await repo.upsertComment(WORKSPACE, comment("x"));
    // Tab B adds its own comment; tab A never saw it.
    await repo.upsertComment(WORKSPACE, comment("y"));
    // Tab A edits its comment from its stale copy.
    await repo.upsertComment(
      WORKSPACE,
      comment("x", { commentText: "edited" }),
    );

    const saved = await repo.listComments(WORKSPACE);
    expect(saved.map((item) => item.id).sort()).toEqual(["x", "y"]);
    expect(saved.find((item) => item.id === "x")?.commentText).toBe("edited");
  });

  it("replaces the whole comment, clearing optional fields that were left out", async () => {
    await repo.upsertComment(
      WORKSPACE,
      comment("x", { pageUrl: "https://app.example.com/a", pageTitle: "A" }),
    );
    await repo.upsertComment(WORKSPACE, comment("x"));

    const [saved] = await repo.listComments(WORKSPACE);
    expect(saved.pageUrl).toBeUndefined();
    expect(saved.pageTitle).toBeUndefined();
  });

  it("deletes only the named comment", async () => {
    await repo.upsertComment(WORKSPACE, comment("x"));
    await repo.upsertComment(WORKSPACE, comment("y"));
    await repo.deleteComment(WORKSPACE, "x");

    const saved = await repo.listComments(WORKSPACE);
    expect(saved.map((item) => item.id)).toEqual(["y"]);
  });

  it("keeps workspaces apart even when ids collide", async () => {
    const other = `${WORKSPACE}-other`;
    await repo.upsertComment(WORKSPACE, comment("x", { commentText: "in a" }));
    await repo.upsertComment(other, comment("x", { commentText: "in b" }));
    await repo.deleteComment(WORKSPACE, "x");

    expect(await repo.listComments(WORKSPACE)).toEqual([]);
    const [kept] = await repo.listComments(other);
    expect(kept.commentText).toBe("in b");
  });
});

describe("groups — ticket fields are server-owned", () => {
  it("a client write after ticket creation does not erase the ticket link", async () => {
    // Both tabs loaded group G before it had a ticket.
    await repo.upsertGroup(WORKSPACE, group("g"));
    // Tab A creates the ticket; the server records it.
    await repo.updateGroupJira(WORKSPACE, "g", "UI-128");
    // Tab B renames G from its stale copy, which has no ticket.
    await repo.upsertGroup(WORKSPACE, group("g", { name: "Renamed" }));

    const [saved] = await repo.listGroups(WORKSPACE);
    expect(saved.name).toBe("Renamed");
    expect(saved.jiraTicketId).toBe("UI-128");
    expect(saved.status).toBe("ticketed");
  });

  it("a write to one group leaves every other group as it was", async () => {
    await repo.upsertGroup(WORKSPACE, group("g"));
    await repo.upsertGroup(WORKSPACE, group("h"));
    await repo.updateGroupJira(WORKSPACE, "g", "UI-128");
    await repo.upsertGroup(WORKSPACE, group("h", { name: "Only H changed" }));

    const saved = await repo.listGroups(WORKSPACE);
    expect(saved.find((item) => item.id === "g")?.jiraTicketId).toBe("UI-128");
    expect(saved.find((item) => item.id === "h")?.name).toBe("Only H changed");
  });

  it("deletes only the named group, which is how synthetic groups are collected", async () => {
    await repo.upsertGroup(WORKSPACE, group("g"));
    await repo.upsertGroup(
      WORKSPACE,
      group("synthetic-1", { synthetic: true }),
    );
    await repo.deleteGroup(WORKSPACE, "synthetic-1");

    const saved = await repo.listGroups(WORKSPACE);
    expect(saved.map((item) => item.id)).toEqual(["g"]);
  });
});
