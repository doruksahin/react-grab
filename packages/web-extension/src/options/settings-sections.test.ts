import { describe, expect, it } from "vitest";
import { anchorHref } from "./anchor-id.js";
import { sectionOfHash } from "./settings-sections.js";

describe("sectionOfHash", () => {
  it("shows the section a hash names", () => {
    expect(sectionOfHash("#workspaces", "sites")).toBe("workspaces");
    expect(sectionOfHash("#sync-server", "sites")).toBe("sync-server");
  });

  it("shows the section that holds a linked row or form", () => {
    expect(sectionOfHash(anchorHref("workspace", "storefront"), "sites")).toBe(
      "workspaces",
    );
    expect(sectionOfHash(anchorHref("jira-account", "acc-1"), "sites")).toBe(
      "jira-accounts",
    );
    expect(sectionOfHash("#add-jira-account", "sites")).toBe("jira-accounts");
    expect(sectionOfHash("#add-site", "sync-server")).toBe("sites");
  });

  it("falls back without a known hash", () => {
    expect(sectionOfHash("", "sync-server")).toBe("sync-server");
    expect(sectionOfHash("#unknown", "sites")).toBe("sites");
  });
});
