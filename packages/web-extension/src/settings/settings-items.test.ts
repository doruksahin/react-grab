import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import {
  readSyncSettings,
  removeSites,
  saveApiToken,
  saveServerUrl,
  saveSite,
} from "./settings-items.js";

describe("settings items", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("starts with no server, no token and no sites", async () => {
    expect(await readSyncSettings()).toEqual({
      serverUrl: null,
      apiToken: null,
      sites: {},
    });
  });

  it("stores a site under its origin and drops trailing slashes from the server URL", async () => {
    await saveServerUrl("https://sync.example.test/");
    await saveSite("https://app.example.test/some/page", {
      workspace: " app ",
      jiraProjectKey: "ATT",
    });

    expect(await readSyncSettings()).toMatchObject({
      serverUrl: "https://sync.example.test",
      sites: {
        "https://app.example.test": { workspace: "app", jiraProjectKey: "ATT" },
      },
    });
  });

  it("refuses invalid values before they reach storage", async () => {
    await expect(saveServerUrl("javascript:alert(1)")).rejects.toThrow();
    await expect(saveApiToken("   ")).rejects.toThrow();
    await expect(
      saveSite("https://app.example.test", {
        workspace: "app",
        jiraProjectKey: "not a key",
      }),
    ).rejects.toThrow();
    expect(await readSyncSettings()).toEqual({
      serverUrl: null,
      apiToken: null,
      sites: {},
    });
  });

  it("removes only the given sites", async () => {
    await saveSite("https://a.test", { workspace: "a", jiraProjectKey: "A" });
    await saveSite("https://b.test", { workspace: "b", jiraProjectKey: "B" });

    await removeSites(["https://a.test"]);

    expect(Object.keys((await readSyncSettings()).sites)).toEqual([
      "https://b.test",
    ]);
  });
});
