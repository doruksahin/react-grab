import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../../worker.js";

/**
 * The health check must answer even when the Jira credential key ring is
 * missing, as it is on a freshly deployed Worker before its secrets are set.
 */
describe("health check", () => {
  it("answers 200 without any Jira configuration", async () => {
    const {
      JIRA_CREDENTIAL_KEYS: _keys,
      JIRA_CREDENTIAL_KEY_CURRENT: _current,
      ...withoutJira
    } = env;
    const response = await worker.request(
      "https://sync.test/health",
      {},
      withoutJira,
    );
    expect(response.status).toBe(200);
  });
});
