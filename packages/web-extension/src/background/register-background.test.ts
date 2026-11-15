import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { extensionMessenger } from "../messaging/extension-messenger.js";
import { enabledItem, toolbarStateItem } from "../storage/overlay-items.js";
import { TOOLBAR_STATE_FIXTURE } from "../test-fixtures.js";
import { registerBackground } from "./register-background.js";

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

describe("registerBackground", () => {
  beforeEach(() => {
    fakeBrowser.reset();
    registerBackground();
  });

  afterEach(() => {
    extensionMessenger.removeAllListeners();
  });

  it("toggles the enabled flag and tells every tab when the action is clicked", async () => {
    const { firstTabId, secondTabId } = await createTabs();
    const sendMessage = vi
      .spyOn(extensionMessenger, "sendMessage")
      .mockResolvedValue(undefined);

    const clickedTab = await fakeBrowser.tabs.get(firstTabId);
    await fakeBrowser.action.onClicked.trigger(clickedTab);

    await vi.waitFor(async () => {
      expect(await enabledItem.getValue()).toBe(false);
      for (const tabId of [firstTabId, secondTabId]) {
        expect(sendMessage).toHaveBeenCalledWith(
          "enabledChanged",
          false,
          tabId,
        );
        expect(await fakeBrowser.action.getBadgeText({ tabId })).toBe("OFF");
        expect(await fakeBrowser.action.getTitle({ tabId })).toBe(
          "React Grab (Inactive)",
        );
      }
    });
  });

  it("clears the badge when the overlay is enabled again", async () => {
    const { firstTabId: tabId } = await createTabs();
    vi.spyOn(extensionMessenger, "sendMessage").mockResolvedValue(undefined);

    await enabledItem.setValue(false);
    await enabledItem.setValue(true);

    await vi.waitFor(async () => {
      expect(await fakeBrowser.action.getBadgeText({ tabId })).toBe("");
      expect(await fakeBrowser.action.getTitle({ tabId })).toBe(
        "React Grab (Active)",
      );
    });
  });

  it("keeps broadcasting to the other tabs when one tab has no relay", async () => {
    const { firstTabId: unreachableTabId, secondTabId: reachableTabId } =
      await createTabs();
    const sendMessage = vi
      .spyOn(extensionMessenger, "sendMessage")
      .mockImplementation((_type, _data, tabId) =>
        tabId === unreachableTabId
          ? Promise.reject(new Error("Receiving end does not exist."))
          : Promise.resolve(undefined),
      );

    await enabledItem.setValue(false);

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        "enabledChanged",
        false,
        reachableTabId,
      );
    });
  });

  it("answers getOverlayState from storage", async () => {
    await toolbarStateItem.setValue(TOOLBAR_STATE_FIXTURE);

    const overlayState = await fakeBrowser.runtime.sendMessage({
      id: 0,
      type: "getOverlayState",
      timestamp: Date.now(),
    });

    expect(overlayState).toEqual({
      res: { enabled: true, toolbarState: TOOLBAR_STATE_FIXTURE },
    });
  });

  it("saves toolbar state and forwards it to every tab except the sender", async () => {
    const { firstTabId: senderTabId, secondTabId: otherTabId } =
      await createTabs();
    const sendMessage = vi
      .spyOn(extensionMessenger, "sendMessage")
      .mockResolvedValue(undefined);
    const senderTab = await fakeBrowser.tabs.get(senderTabId);

    await fakeBrowser.runtime.onMessage.trigger(
      {
        id: 1,
        type: "saveToolbarState",
        data: TOOLBAR_STATE_FIXTURE,
        timestamp: Date.now(),
      },
      { tab: senderTab },
      () => undefined,
    );
    await vi.waitFor(async () => {
      expect(await toolbarStateItem.getValue()).toEqual(TOOLBAR_STATE_FIXTURE);
      expect(sendMessage).toHaveBeenCalledWith(
        "toolbarStateChanged",
        TOOLBAR_STATE_FIXTURE,
        otherTabId,
      );
    });
    expect(sendMessage).not.toHaveBeenCalledWith(
      "toolbarStateChanged",
      TOOLBAR_STATE_FIXTURE,
      senderTabId,
    );
  });
});
