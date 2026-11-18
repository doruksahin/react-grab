import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { sitesItem } from "../settings/settings-items.js";
import { readActiveTabSite } from "./read-active-tab-site.js";

const ADDED_ORIGIN = "https://shop.example";

const openActiveTab = async (url: string): Promise<void> => {
  const window = await fakeBrowser.windows.create({ focused: true });
  await fakeBrowser.tabs.create({ url, active: true, windowId: window?.id });
};

describe("readActiveTabSite", () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await sitesItem.setValue({
      [ADDED_ORIGIN]: {
        workspace: "storefront",
        recordSteps: false,
        recordSession: false,
      },
    });
  });

  it("reports an added site as added", async () => {
    await openActiveTab(`${ADDED_ORIGIN}/cart?step=2`);

    expect(await readActiveTabSite()).toEqual({
      origin: ADDED_ORIGIN,
      isAdded: true,
    });
  });

  it("reports a site that is not added", async () => {
    await openActiveTab("https://blog.example/post");

    expect(await readActiveTabSite()).toEqual({
      origin: "https://blog.example",
      isAdded: false,
    });
  });

  it("returns null on a page that is not a web site", async () => {
    await openActiveTab("chrome://extensions/");

    expect(await readActiveTabSite()).toBeNull();
  });
});
