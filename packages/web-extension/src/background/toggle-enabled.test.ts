import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { enabledItem } from "../storage/overlay-items.js";
import { toggleEnabled } from "./toggle-enabled.js";

describe("toggleEnabled", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("disables the overlay on the first toggle, because it is enabled by default", async () => {
    expect(await toggleEnabled()).toBe(false);
    expect(await enabledItem.getValue()).toBe(false);
  });

  it("flips the stored flag on every toggle", async () => {
    await toggleEnabled();
    expect(await toggleEnabled()).toBe(true);
    expect(await enabledItem.getValue()).toBe(true);
  });
});
