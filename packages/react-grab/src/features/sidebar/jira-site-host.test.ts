import { describe, expect, it } from "vitest";
import { getJiraSiteHost } from "./jira-site-host.js";

describe("getJiraSiteHost", () => {
  it("takes the host of the first ticket link", () => {
    expect(
      getJiraSiteHost([
        { jiraUrl: undefined },
        { jiraUrl: "https://acme.atlassian.net/browse/ATT-1" },
        { jiraUrl: "https://other.atlassian.net/browse/X-1" },
      ]),
    ).toBe("acme.atlassian.net");
  });

  it("skips links that are not URLs", () => {
    expect(
      getJiraSiteHost([
        { jiraUrl: "not a url" },
        { jiraUrl: "https://acme.atlassian.net/browse/ATT-1" },
      ]),
    ).toBe("acme.atlassian.net");
  });

  it("is null when no group has a ticket link", () => {
    expect(getJiraSiteHost([{ jiraUrl: undefined }])).toBeNull();
  });
});
