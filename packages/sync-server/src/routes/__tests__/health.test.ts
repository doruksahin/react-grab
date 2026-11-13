import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../../worker.js";

/**
 * The health check must answer even when the Jira configuration is missing,
 * as it is on a freshly deployed Worker before its Jira secrets are set.
 */
describe("health check", () => {
  it("answers 200 without any Jira configuration", async () => {
    const { JIRA_EMAIL: _email, JIRA_API_TOKEN: _token, ...withoutJira } = env;
    const response = await worker.request(
      "https://sync.test/health",
      {},
      withoutJira,
    );
    expect(response.status).toBe(200);
  });
});
