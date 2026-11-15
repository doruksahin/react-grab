import { describe, expect, it } from "vitest";
import { getSiteHost } from "./site-host.js";

describe("getSiteHost", () => {
  it("returns the host of the site URL", () => {
    expect(getSiteHost("https://acme.atlassian.net")).toBe(
      "acme.atlassian.net",
    );
    expect(getSiteHost("https://acme.atlassian.net/")).toBe(
      "acme.atlassian.net",
    );
  });

  it("is null without a usable URL", () => {
    expect(getSiteHost(null)).toBeNull();
    expect(getSiteHost("")).toBeNull();
    expect(getSiteHost("not a url")).toBeNull();
  });
});
