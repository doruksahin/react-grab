import { describe, expect, it } from "vitest";
import { parsePersonalJiraCredential } from "./personal-jira-credential.js";

describe("parsePersonalJiraCredential", () => {
  it("reads the email and token from base64(email:token)", () => {
    expect(
      parsePersonalJiraCredential(btoa("ayse@example.com:secret:with:colons")),
    ).toEqual({ email: "ayse@example.com", apiToken: "secret:with:colons" });
  });

  it("is undefined without a header", () => {
    expect(parsePersonalJiraCredential(undefined)).toBeUndefined();
  });

  it("is undefined for a value that is not base64(email:token)", () => {
    expect(parsePersonalJiraCredential("%%%")).toBeUndefined();
    expect(parsePersonalJiraCredential(btoa("no-separator"))).toBeUndefined();
    expect(parsePersonalJiraCredential(btoa(":token-only"))).toBeUndefined();
  });
});
