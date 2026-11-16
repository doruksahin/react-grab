import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSignal, type JSX } from "solid-js";
import { renderHook } from "@solidjs/testing-library";
import { SyncProvider } from "../../sync/sync-context.js";
import type { StorageAdapter } from "../../sync/types.js";
import type { ScreenshotRef } from "../types.js";
import { useScreenshotUrl } from "./use-screenshot-url.js";
import { createFakeStorage } from "../../../test-support/fake-ports.js";

interface Deferred {
  resolve: (blob: Blob) => void;
}

const pending = new Map<string, Deferred>();
const loadScreenshot = vi.fn<StorageAdapter["loadScreenshot"]>(
  (selectionId) =>
    new Promise<Blob>((resolve) => pending.set(selectionId, { resolve })),
);

const storage: StorageAdapter = { ...createFakeStorage(), loadScreenshot };

const Wrapper = (props: { children: JSX.Element }) => (
  <SyncProvider
    value={{
      storage: () => storage,
      jira: () => null,
      jiraProjectKey: () => null,
      refreshJiraStatus: async () => {},
    }}
  >
    {props.children}
  </SyncProvider>
);

const createObjectURL = vi.fn((blob: Blob) => `blob:${blob.size}`);
const revokeObjectURL = vi.fn();

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  pending.clear();
  loadScreenshot.mockClear();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
});

describe("useScreenshotUrl", () => {
  it("shows only the latest screenshot when an earlier load finishes late", async () => {
    const [target, setTarget] = createSignal<ScreenshotRef | undefined>({
      selectionId: "first",
      kind: "element",
    });
    const { result, cleanup } = renderHook(() => useScreenshotUrl(target), {
      wrapper: Wrapper,
    });

    setTarget({ selectionId: "second", kind: "element" });
    pending.get("second")?.resolve(new Blob(["22"]));
    await flush();
    pending.get("first")?.resolve(new Blob(["1"]));
    await flush();

    expect(result()).toBe("blob:2");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("releases the blob URL when the screenshot changes and on unmount", async () => {
    const [target, setTarget] = createSignal<ScreenshotRef | undefined>({
      selectionId: "first",
      kind: "full",
    });
    const { result, cleanup } = renderHook(() => useScreenshotUrl(target), {
      wrapper: Wrapper,
    });
    pending.get("first")?.resolve(new Blob(["1"]));
    await flush();
    expect(result()).toBe("blob:1");

    setTarget(undefined);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:1");
    expect(result()).toBeUndefined();

    setTarget({ selectionId: "second", kind: "full" });
    pending.get("second")?.resolve(new Blob(["22"]));
    await flush();
    cleanup();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:2");
  });
});
