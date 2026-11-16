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
      recordSteps: false,
      recordSession: false,
    });

    expect(await readSyncSettings()).toMatchObject({
      serverUrl: "https://sync.example.test",
      sites: {
        "https://app.example.test": { workspace: "app", jiraProjectKey: "ATT", recordSteps: false, recordSession: false },
      },
    });
  });

  it("accepts https and local http server URLs and stores them without a trailing slash", async () => {
    const accepted = [
      ["https://sync.example.test/", "https://sync.example.test"],
      ["https://sync.example.test/api/v1/", "https://sync.example.test/api/v1"],
      ["http://localhost:8787", "http://localhost:8787"],
      ["http://127.0.0.1:8787/", "http://127.0.0.1:8787"],
      ["http://[::1]:8787", "http://[::1]:8787"],
    ];
    for (const [input, stored] of accepted) {
      await saveServerUrl(input ?? "");
      expect((await readSyncSettings()).serverUrl).toBe(stored);
    }
  });

  it("refuses insecure or ambiguous server URLs", async () => {
    for (const serverUrl of [
      "http://sync.example.test",
      "ftp://sync.example.test",
      "https://user:pass@sync.example.test",
      "https://sync.example.test/?workspace=other",
      "https://sync.example.test/#fragment",
      "not a url",
    ]) {
      await expect(saveServerUrl(serverUrl), serverUrl).rejects.toThrow();
    }
    expect((await readSyncSettings()).serverUrl).toBeNull();
  });

  it("refuses invalid values before they reach storage", async () => {
    await expect(saveServerUrl("javascript:alert(1)")).rejects.toThrow();
    await expect(saveApiToken("   ")).rejects.toThrow();
    await expect(
      saveSite("https://app.example.test", {
        workspace: "app",
        jiraProjectKey: "not a key",
        recordSteps: false,
        recordSession: false,
      }),
    ).rejects.toThrow();
    expect(await readSyncSettings()).toEqual({
      serverUrl: null,
      apiToken: null,
      sites: {},
    });
  });

  it("removes only the given sites", async () => {
    await saveSite("https://a.test", { workspace: "a", jiraProjectKey: "A", recordSteps: false, recordSession: false });
    await saveSite("https://b.test", { workspace: "b", jiraProjectKey: "B", recordSteps: false, recordSession: false });

    await removeSites(["https://a.test"]);

    expect(Object.keys((await readSyncSettings()).sites)).toEqual([
      "https://b.test",
    ]);
  });
});
