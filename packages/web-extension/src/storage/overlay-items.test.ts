import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { TOOLBAR_STATE_FIXTURE } from "../test-fixtures.js";
import {
  enabledItem,
  readOverlayState,
  toolbarStateItem,
} from "./overlay-items.js";

describe("overlay storage items", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("reports the overlay as enabled with no toolbar state when storage is empty", async () => {
    expect(await readOverlayState()).toEqual({
      enabled: true,
      toolbarState: null,
    });
  });

  it("keeps the storage.local keys of the previous extension build", async () => {
    await enabledItem.setValue(false);
    await toolbarStateItem.setValue(TOOLBAR_STATE_FIXTURE);

    expect(await fakeBrowser.storage.local.get(null)).toEqual({
      react_grab_enabled: false,
      react_grab_toolbar_state: TOOLBAR_STATE_FIXTURE,
    });
  });

  it("reads values written by the previous extension build", async () => {
    await fakeBrowser.storage.local.set({
      react_grab_enabled: false,
      react_grab_toolbar_state: TOOLBAR_STATE_FIXTURE,
    });

    expect(await readOverlayState()).toEqual({
      enabled: false,
      toolbarState: TOOLBAR_STATE_FIXTURE,
    });
  });
});
