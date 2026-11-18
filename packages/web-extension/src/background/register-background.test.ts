import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import {
  extensionEventMessenger,
  extensionRequestMessenger,
  settingsMessenger,
} from "../messaging/extension-messengers.js";
import { enabledItem, toolbarStateItem } from "../storage/overlay-items.js";
import { TOOLBAR_STATE_FIXTURE } from "../test-fixtures.js";
import {
  saveApiToken,
  saveServerUrl,
  saveSite,
  sitesItem,
} from "../settings/settings-items.js";
import { registerBackground } from "./register-background.js";
import {
  SITE_ORIGIN,
  sendAsOptionsPage,
  sendAsOwnContentScript,
} from "../test-support/senders.js";

interface TestTabs {
  firstTabId: number;
  secondTabId: number;
}

const createTabs = async (): Promise<TestTabs> => {
  const firstTab = await fakeBrowser.tabs.create({
    url: "https://first.example/",
  });
  const secondTab = await fakeBrowser.tabs.create({
    url: "https://second.example/",
  });
  if (firstTab.id === undefined || secondTab.id === undefined) {
    throw new Error("fake-browser created a tab without an id");
  }
  return { firstTabId: firstTab.id, secondTabId: secondTab.id };
};

const spyOnEvents = () =>
  vi.spyOn(extensionEventMessenger, "sendMessage").mockResolvedValue(undefined);

describe("registerBackground", () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.spyOn(fakeBrowser.permissions.onRemoved, "addListener").mockReturnValue(
      undefined,
    );
    vi.spyOn(fakeBrowser.storage.local, "setAccessLevel").mockResolvedValue(
      undefined,
    );
    registerBackground();
  });

  afterEach(() => {
    extensionEventMessenger.removeAllListeners();
    extensionRequestMessenger.removeAllListeners();
    settingsMessenger.removeAllListeners();
  });

  it("badges the action and tells every tab when the overlay is turned off", async () => {
    const { firstTabId, secondTabId } = await createTabs();
    const sendEvent = spyOnEvents();

    await enabledItem.setValue(false);

    await vi.waitFor(async () => {
      expect(await fakeBrowser.action.getBadgeText({})).toBe("OFF");
      expect(await fakeBrowser.action.getTitle({})).toBe(
        "React Grab (Inactive)",
      );
      for (const tabId of [firstTabId, secondTabId]) {
        expect(sendEvent).toHaveBeenCalledWith("enabledChanged", false, tabId);
      }
    });
  });

  it("clears the badge when the overlay is enabled again", async () => {
    spyOnEvents();

    await enabledItem.setValue(false);
    await enabledItem.setValue(true);

    await vi.waitFor(async () => {
      expect(await fakeBrowser.action.getBadgeText({})).toBe("");
      expect(await fakeBrowser.action.getTitle({})).toBe("React Grab (Active)");
    });
  });

  it("restores the badge from storage when the browser starts", async () => {
    await fakeBrowser.storage.local.set({ react_grab_enabled: false });
    await fakeBrowser.action.setBadgeText({ text: "" });

    await fakeBrowser.runtime.onStartup.trigger();

    await vi.waitFor(async () => {
      expect(await fakeBrowser.action.getBadgeText({})).toBe("OFF");
    });
  });

  it("keeps broadcasting to the other tabs when one tab has no relay", async () => {
    const { firstTabId: unreachableTabId, secondTabId: reachableTabId } =
      await createTabs();
    const sendEvent = vi
      .spyOn(extensionEventMessenger, "sendMessage")
      .mockImplementation((_type, _data, tabId) =>
        tabId === unreachableTabId
          ? Promise.reject(new Error("Receiving end does not exist."))
          : Promise.resolve(undefined),
      );

    await enabledItem.setValue(false);

    await vi.waitFor(() => {
      expect(sendEvent).toHaveBeenCalledWith(
        "enabledChanged",
        false,
        reachableTabId,
      );
    });
  });

  it("answers getOverlayState with the enabled flag and the saved toolbar state", async () => {
    sendAsOwnContentScript();
    await enabledItem.setValue(false);
    await toolbarStateItem.setValue(TOOLBAR_STATE_FIXTURE);

    expect(
      await extensionRequestMessenger.sendMessage("getOverlayState"),
    ).toEqual({
      enabled: false,
      toolbarState: TOOLBAR_STATE_FIXTURE,
    });
  });

  it("saves a valid toolbar state and forwards it to every tab", async () => {
    sendAsOwnContentScript();
    const { firstTabId, secondTabId } = await createTabs();
    const sendEvent = spyOnEvents();

    await extensionRequestMessenger.sendMessage(
      "saveToolbarState",
      TOOLBAR_STATE_FIXTURE,
    );

    expect(await toolbarStateItem.getValue()).toEqual(TOOLBAR_STATE_FIXTURE);
    await vi.waitFor(() => {
      for (const tabId of [firstTabId, secondTabId]) {
        expect(sendEvent).toHaveBeenCalledWith(
          "toolbarStateChanged",
          TOOLBAR_STATE_FIXTURE,
          tabId,
        );
      }
    });
  });

  it("rejects a toolbar state that does not match the schema", async () => {
    sendAsOwnContentScript();
    const invalidToolbarState = { ...TOOLBAR_STATE_FIXTURE };
    Reflect.set(invalidToolbarState, "edge", "middle");

    await expect(
      extensionRequestMessenger.sendMessage(
        "saveToolbarState",
        invalidToolbarState,
      ),
    ).rejects.toThrow();
    expect(await toolbarStateItem.getValue()).toBeNull();
  });

  it("restricts storage.local to the extension's own contexts", () => {
    expect(fakeBrowser.storage.local.setAccessLevel).toHaveBeenCalledWith({
      accessLevel: "TRUSTED_CONTEXTS",
    });
  });

  it("answers getSiteSettings with the sender origin's site, never the token", async () => {
    sendAsOwnContentScript();
    await saveSite(SITE_ORIGIN, {
      workspace: "app-workspace",
      recordSteps: false,
      recordSession: false,
    });
    await saveApiToken("unit-test-token");

    expect(
      await extensionRequestMessenger.sendMessage("getSiteSettings"),
    ).toEqual({
      workspace: "app-workspace",
      recordSteps: false,
      recordSession: false,
    });
  });

  it("answers getSiteSettings with null for an origin that is not enabled", async () => {
    sendAsOwnContentScript();

    expect(
      await extensionRequestMessenger.sendMessage("getSiteSettings"),
    ).toBeNull();
  });

  it("rejects requests from a sender outside this extension", async () => {
    await expect(
      extensionRequestMessenger.sendMessage("getOverlayState"),
    ).rejects.toThrow("the sender is not this extension");
  });

  it("writes sites only on a request from an extension page", async () => {
    const site = {
      workspace: "app-workspace",
      recordSteps: false,
      recordSession: false,
    };

    sendAsOwnContentScript();
    await expect(
      settingsMessenger.sendMessage("saveSite", { origin: SITE_ORIGIN, site }),
    ).rejects.toThrow("the sender is not an extension page");
    expect(await sitesItem.getValue()).toEqual({});

    vi.restoreAllMocks();
    sendAsOptionsPage();
    await settingsMessenger.sendMessage("saveSite", {
      origin: SITE_ORIGIN,
      site,
    });
    expect(await sitesItem.getValue()).toEqual({ [SITE_ORIGIN]: site });
  });

  it("gives back the old server origin's permission when the server URL moves", async () => {
    const removePermission = vi
      .spyOn(fakeBrowser.permissions, "remove")
      .mockResolvedValue(undefined);

    await saveServerUrl("https://old-sync.example.test");
    await saveServerUrl("https://new-sync.example.test/api");

    await vi.waitFor(() => {
      expect(removePermission).toHaveBeenCalledWith({
        origins: ["https://old-sync.example.test/*"],
      });
    });
  });
});
