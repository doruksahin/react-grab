import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { authorized } from "../../test/api-token.js";

/** The overlay names the site in the Jira dialog (ADR-0022 step 3, S5.1). */
describe("GET /jira/site", () => {
  it("returns the configured Jira site", async () => {
    const response = await SELF.fetch("https://sync.test/jira/site", {
      headers: authorized(),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ siteUrl: "https://jira.invalid" });
  });

  it("requires the API token", async () => {
    const response = await SELF.fetch("https://sync.test/jira/site");
    expect(response.status).toBe(401);
  });
});
