import { describe, it, expect } from "vitest";
import { parseAdminEnv, parseCredentialEnv, parseJiraEnv } from "./env.js";

const valid = {
  JIRA_BASE_URL: "https://acme.atlassian.net",
  JIRA_EMAIL: "bot@acme.com",
  JIRA_API_TOKEN: "token-123",
};

describe("parseJiraEnv", () => {
  it("returns the configuration when every value is set", () => {
    expect(parseJiraEnv(valid)).toEqual(valid);
  });

  it("ignores bindings that are not Jira configuration", () => {
    expect(parseJiraEnv({ ...valid, DB: {}, BUCKET: {} })).toEqual(valid);
  });

  it("rejects the empty email that used to sit in wrangler.toml", () => {
    expect(() => parseJiraEnv({ ...valid, JIRA_EMAIL: "" })).toThrow(
      /JIRA_EMAIL is empty/,
    );
  });

  it("rejects a missing API token and says how to set it", () => {
    expect(() => parseJiraEnv({ ...valid, JIRA_API_TOKEN: "" })).toThrow(
      /wrangler secret put JIRA_API_TOKEN/,
    );
  });

  it("rejects a site that is not a URL", () => {
    expect(() => parseJiraEnv({ ...valid, JIRA_BASE_URL: "acme" })).toThrow(
      /JIRA_BASE_URL must be a full URL/,
    );
  });

  it("names every problem at once", () => {
    try {
      parseJiraEnv({
        JIRA_BASE_URL: "acme",
        JIRA_EMAIL: "",
        JIRA_API_TOKEN: "",
      });
      throw new Error("expected parseJiraEnv to throw");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("JIRA_BASE_URL");
      expect(message).toContain("JIRA_EMAIL");
      expect(message).toContain("JIRA_API_TOKEN");
    }
  });
});

describe("parseCredentialEnv (ADR-0027)", () => {
  const KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";

  it("accepts a key ring whose current version exists", () => {
    expect(
      parseCredentialEnv({
        JIRA_CREDENTIAL_KEYS: JSON.stringify({ v1: KEY }),
        JIRA_CREDENTIAL_KEY_CURRENT: "v1",
      }).JIRA_CREDENTIAL_KEYS,
    ).toEqual({ v1: KEY });
  });

  it("refuses a key that is not 32 bytes", () => {
    expect(() =>
      parseCredentialEnv({
        JIRA_CREDENTIAL_KEYS: JSON.stringify({ v1: "c2hvcnQ=" }),
        JIRA_CREDENTIAL_KEY_CURRENT: "v1",
      }),
    ).toThrow(/32 random bytes/);
  });

  it("refuses a current version the ring does not have", () => {
    expect(() =>
      parseCredentialEnv({
        JIRA_CREDENTIAL_KEYS: JSON.stringify({ v1: KEY }),
        JIRA_CREDENTIAL_KEY_CURRENT: "v2",
      }),
    ).toThrow(/JIRA_CREDENTIAL_KEY_CURRENT names a version/);
  });

  it("refuses a key ring that is not JSON", () => {
    expect(() =>
      parseCredentialEnv({
        JIRA_CREDENTIAL_KEYS: "nope",
        JIRA_CREDENTIAL_KEY_CURRENT: "v1",
      }),
    ).toThrow(/must be JSON/);
  });
});

describe("parseAdminEnv (ADR-0027)", () => {
  it("fails closed without a long enough admin token", () => {
    expect(() => parseAdminEnv({ SYNC_ADMIN_TOKEN: "short" })).toThrow(
      /SYNC_ADMIN_TOKEN is missing or shorter/,
    );
  });
});
