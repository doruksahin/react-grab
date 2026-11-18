import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import {
  personalJiraAccountItem,
  saveApiToken,
  saveServerUrl,
  saveSite,
} from "../settings/settings-items.js";
import {
  connectPersonalJira,
  disconnectPersonalJira,
} from "./connect-personal-jira.js";

const SERVER_URL = "https://sync.example.com";
const SYNC_TOKEN = "sync-token-0123456789abcdef0123456789";

describe("connectPersonalJira (ADR-0031)", () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await saveServerUrl(SERVER_URL);
    await saveApiToken(SYNC_TOKEN);
  });

  it("asks the server who the token signs in as, on the first site's workspace, and keeps both", async () => {
    await saveSite("https://shop.example", {
      workspace: "storefront",
      recordSteps: false,
      recordSession: false,
    });
    const verify = vi.fn(async () => ({
      accountId: "a-1",
      displayName: "Ayşe Yılmaz",
    }));

    const identity = await connectPersonalJira(
      { email: " ayse@acme.com ", apiToken: "personal-token" },
      verify,
    );

    expect(identity).toEqual({ accountId: "a-1", displayName: "Ayşe Yılmaz" });
    expect(verify).toHaveBeenCalledWith({
      serverUrl: SERVER_URL,
      apiToken: SYNC_TOKEN,
      workspace: "storefront",
      jiraCredential: btoa("ayse@acme.com:personal-token"),
    });
    expect(await personalJiraAccountItem.getValue()).toEqual({
      email: "ayse@acme.com",
      apiToken: "personal-token",
      accountId: "a-1",
      displayName: "Ayşe Yılmaz",
    });

    await disconnectPersonalJira();
    expect(await personalJiraAccountItem.getValue()).toBeNull();
  });

  it("refuses before any site is enabled, since the site's workspace names the Jira site", async () => {
    const verify = vi.fn();

    await expect(
      connectPersonalJira(
        { email: "ayse@acme.com", apiToken: "personal-token" },
        verify,
      ),
    ).rejects.toThrow(/enable a site first/);
    expect(verify).not.toHaveBeenCalled();
  });
});
