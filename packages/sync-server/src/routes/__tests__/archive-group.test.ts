import { SELF, env } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../db/schema.js";
import { seedJiraAccount } from "../../test/seed-jira-account.js";
import { D1SyncRepository } from "../../repositories/d1.repo.js";
import { authorized } from "../../test/api-token.js";

/**
 * ADR-0030: a group with a Jira ticket can be archived and restored; the
 * server owns the archive time, and a group without a ticket is refused.
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

interface GroupBody {
  id: string;
  archivedAt?: number;
  jiraTicketId?: string;
}

const listedGroup = async (): Promise<GroupBody | undefined> => {
  const response = await SELF.fetch(`${BASE}/groups`, {
    headers: authorized(),
  });
  const groups: GroupBody[] = await response.json();
  return groups.find((group) => group.id === "g-1");
};

const seedGroup = async (options: { ticketed: boolean }) => {
  await send("PUT", "/groups/g-1", {
    id: "g-1",
    name: "Checkout",
    createdAt: 1,
  });
  if (options.ticketed) {
    const repo = new D1SyncRepository(drizzle(env.DB, { schema }));
    await repo.updateGroupJira(
      WORKSPACE,
      "g-1",
      "UI-1",
      await seedJiraAccount("account-1"),
    );
  }
};

describe("archiving a group", () => {
  it("archives a ticketed group with the server's time and keeps its ticket", async () => {
    await seedGroup({ ticketed: true });
    const before = Date.now();

    const response = await send("PUT", "/groups/g-1/archive");
    expect(response.status).toBe(200);
    const body: GroupBody = await response.json();
    expect(body.archivedAt).toBeGreaterThanOrEqual(before);

    const listed = await listedGroup();
    expect(listed?.archivedAt).toBe(body.archivedAt);
    expect(listed?.jiraTicketId).toBe("UI-1");
  });

  it("keeps the first archive time when archived twice", async () => {
    await seedGroup({ ticketed: true });
    const first: GroupBody = await (
      await send("PUT", "/groups/g-1/archive")
    ).json();
    const second: GroupBody = await (
      await send("PUT", "/groups/g-1/archive")
    ).json();
    expect(second.archivedAt).toBe(first.archivedAt);
  });

  it("refuses a group without a ticket", async () => {
    await seedGroup({ ticketed: false });
    const response = await send("PUT", "/groups/g-1/archive");
    expect(response.status).toBe(409);
    expect((await listedGroup())?.archivedAt).toBeUndefined();
  });

  it("answers 404 for a group that does not exist", async () => {
    expect((await send("PUT", "/groups/missing/archive")).status).toBe(404);
    expect((await send("DELETE", "/groups/missing/archive")).status).toBe(404);
  });

  it("restores an archived group", async () => {
    await seedGroup({ ticketed: true });
    await send("PUT", "/groups/g-1/archive");

    const response = await send("DELETE", "/groups/g-1/archive");
    expect(response.status).toBe(200);
    const body: GroupBody = await response.json();
    expect(body.archivedAt).toBeUndefined();
    expect((await listedGroup())?.archivedAt).toBeUndefined();
  });

  it("does not let a group write archive or restore it", async () => {
    await seedGroup({ ticketed: true });
    await send("PUT", "/groups/g-1/archive");
    const archivedAt = (await listedGroup())?.archivedAt;

    // A stale client writes the group without the field, or with its own.
    await send("PUT", "/groups/g-1", {
      id: "g-1",
      name: "Renamed",
      createdAt: 1,
    });
    expect((await listedGroup())?.archivedAt).toBe(archivedAt);
    await send("PUT", "/groups/g-1", {
      id: "g-1",
      name: "Renamed",
      createdAt: 1,
      archivedAt: 5,
    });
    expect((await listedGroup())?.archivedAt).toBe(archivedAt);
  });
});
