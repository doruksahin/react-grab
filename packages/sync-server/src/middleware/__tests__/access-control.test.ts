import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { authorized } from "../../test/api-token.js";

/**
 * ADR-0020 through the Worker's own entry point. No request reaches Jira:
 * the Jira routes are only called without a token, which stops them first.
 */

const BASE = "https://sync.test";

describe("API token", () => {
  it("refuses a data request without a token", async () => {
    const response = await SELF.fetch(`${BASE}/workspaces/ws-a/comments`);
    expect(response.status).toBe(401);
  });

  it("refuses a data request with the wrong token", async () => {
    const response = await SELF.fetch(`${BASE}/workspaces/ws-a/comments`, {
      headers: { Authorization: "Bearer not-the-token" },
    });
    expect(response.status).toBe(401);
  });

  it("serves a data request with the token", async () => {
    const response = await SELF.fetch(`${BASE}/workspaces/ws-a/comments`, {
      headers: authorized(),
    });
    expect(response.status).toBe(200);
  });

  it("stops a ticket request without a token before it can reach Jira", async () => {
    const response = await SELF.fetch(
      `${BASE}/workspaces/ws-a/groups/g-1/jira-ticket`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectKey: "SCRUM", summary: "x" }),
      },
    );
    expect(response.status).toBe(401);
  });

  it("stops the Jira lookup routes without a token", async () => {
    const response = await SELF.fetch(`${BASE}/jira/priorities`);
    expect(response.status).toBe(401);
  });

  it("keeps the health check public", async () => {
    const response = await SELF.fetch(`${BASE}/health`);
    expect(response.status).toBe(200);
  });
});

describe("origin allowlist", () => {
  const preflight = (origin: string) =>
    SELF.fetch(`${BASE}/workspaces/ws-a/comments/c-1`, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "authorization, content-type",
      },
    });

  it("answers a preflight from a local dev server without asking for a token", async () => {
    const response = await preflight("http://localhost:5173");
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:5173",
    );
    expect(
      response.headers.get("Access-Control-Allow-Headers")?.toLowerCase(),
    ).toContain("authorization");
  });

  it("allows an origin listed in ALLOWED_ORIGINS", async () => {
    const response = await preflight("https://staging.example.com");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://staging.example.com",
    );
  });

  it("gives any other origin no permission", async () => {
    const response = await preflight("https://evil.example");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("no longer answers every origin with a wildcard", async () => {
    const response = await SELF.fetch(`${BASE}/health`, {
      headers: { Origin: "https://evil.example" },
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).not.toBe("*");
  });
});
