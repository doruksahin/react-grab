import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { asAdmin, authorized } from "../../test/api-token.js";

/*
 * ADR-0027 over HTTP: who may call what, and what the routes refuse before
 * any Jira call. No test here reaches Jira.
 */

const json = (headers: Record<string, string>) => ({
  ...headers,
  "Content-Type": "application/json",
});

describe("admin routes", () => {
  it("refuse the sync token: host apps cannot add accounts or rebind workspaces", async () => {
    const accounts = await SELF.fetch("https://sync.test/jira-accounts", {
      headers: authorized(),
    });
    expect(accounts.status).toBe(401);

    const bind = await SELF.fetch("https://sync.test/workspaces/ws-a/jira", {
      method: "PUT",
      headers: json(authorized()),
      body: JSON.stringify({ jiraAccountId: "x", projectKey: "SCRUM" }),
    });
    expect(bind.status).toBe(401);

    const clear = await SELF.fetch("https://sync.test/workspaces/ws-a/jira", {
      method: "DELETE",
      headers: authorized(),
    });
    expect(clear.status).toBe(401);
  });

  it("accept the admin token", async () => {
    const response = await SELF.fetch("https://sync.test/jira-accounts", {
      headers: asAdmin(),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("refuse a site that is not a Jira Cloud site, before calling it", async () => {
    for (const siteUrl of [
      "http://acme.atlassian.net",
      "https://evil.example.com",
      "https://acme.atlassian.net.evil.com",
      "https://user:pw@acme.atlassian.net",
      "https://acme.atlassian.net:8443",
    ]) {
      const response = await SELF.fetch("https://sync.test/jira-accounts", {
        method: "POST",
        headers: json(asAdmin()),
        body: JSON.stringify({
          siteUrl,
          email: "a@example.com",
          apiToken: "t",
        }),
      });
      expect(response.status, siteUrl).toBe(400);
    }
  });

  it("answer a missing account with its code", async () => {
    const response = await SELF.fetch(
      "https://sync.test/jira-accounts/missing/projects",
      { headers: asAdmin() },
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      code: "jira-account-not-found",
    });
  });

  it("treat removing an absent account as done", async () => {
    const response = await SELF.fetch(
      "https://sync.test/jira-accounts/missing",
      { method: "DELETE", headers: asAdmin() },
    );
    expect(response.status).toBe(204);
  });
});

describe("workspace routes", () => {
  it("list workspaces that have been written to", async () => {
    await SELF.fetch("https://sync.test/workspaces/ws-listed/groups/g-1", {
      method: "PUT",
      headers: json(authorized()),
      body: JSON.stringify({ id: "g-1", name: "G", createdAt: 1 }),
    });
    const response = await SELF.fetch("https://sync.test/workspaces", {
      headers: authorized(),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toContainEqual({
      id: "ws-listed",
      jiraAccountId: null,
      jiraProjectKey: null,
      siteUrl: null,
    });
  });

  it("create a workspace on PUT", async () => {
    const put = await SELF.fetch("https://sync.test/workspaces/ws-new", {
      method: "PUT",
      headers: authorized(),
    });
    expect(put.status).toBe(204);
    const list = await SELF.fetch("https://sync.test/workspaces", {
      headers: authorized(),
    });
    const ids = ((await list.json()) as Array<{ id: string }>).map(
      (workspace) => workspace.id,
    );
    expect(ids).toContain("ws-new");
  });

  it("name a workspace without a destination", async () => {
    const response = await SELF.fetch(
      "https://sync.test/workspaces/ws-unbound/jira",
      { headers: authorized() },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "jira-destination-missing",
    });
  });

  it("answer jira-destination-missing for a workspace without a destination", async () => {
    const response = await SELF.fetch(
      "https://sync.test/workspaces/ws-unbound/jira?projectKey=SCRUM",
      { headers: authorized() },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "jira-destination-missing",
    });
  });

  it("refuse to bind a workspace to an unknown account", async () => {
    const response = await SELF.fetch(
      "https://sync.test/workspaces/ws-a/jira",
      {
        method: "PUT",
        headers: json(asAdmin()),
        body: JSON.stringify({ jiraAccountId: "missing", projectKey: "SCRUM" }),
      },
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      code: "jira-account-not-found",
    });
  });

  it("name a group without a ticket", async () => {
    const response = await SELF.fetch(
      "https://sync.test/workspaces/ws-a/groups/none/jira-status",
      { headers: authorized() },
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      code: "jira-ticket-missing",
    });
  });
});
