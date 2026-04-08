// packages/react-grab/src/core/plugins/recorder/index.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { recorderPlugin, controls } from "./index.js";
import type { ReactGrabAPI } from "../../../types.js";

const stubApi: Pick<ReactGrabAPI, "getSource"> = {
  getSource: vi.fn(async () => ({
    filePath: "src/foo.tsx",
    lineNumber: 1,
    componentName: "Foo",
  })),
};

const cleanupPlugin = () => {
  const config = recorderPlugin.setup?.(stubApi as ReactGrabAPI, {} as never);
  config?.cleanup?.();
};

describe("recorderPlugin.controls — required shape", () => {
  it("exposes the 7 required methods as functions", () => {
    for (const name of [
      "start", "stop", "toggle", "copyJson", "copyText", "clear", "isCapturing",
    ] as const) {
      expect(typeof controls[name]).toBe("function");
    }
  });

  it("recorderPlugin.controls is the same reference as the named export", () => {
    expect((recorderPlugin as unknown as { controls: typeof controls }).controls)
      .toBe(controls);
  });
});

describe("recorderPlugin.controls — no-controller behavior", () => {
  beforeEach(() => {
    cleanupPlugin();
    cleanupPlugin(); // ensure null after re-run
  });

  it("isCapturing returns false silently before registration", () => {
    expect(controls.isCapturing()).toBe(false);
  });

  it("start/stop/toggle/clear return undefined and do not throw", () => {
    expect(() => {
      controls.start();
      controls.stop();
      controls.toggle();
      controls.clear();
    }).not.toThrow();
    expect(controls.start()).toBeUndefined();
  });

  it("copyJson rejects with 'not registered' error", async () => {
    await expect(controls.copyJson()).rejects.toThrow(/Recorder plugin is not registered/);
  });

  it("copyText rejects with 'not registered' error", async () => {
    await expect(controls.copyText()).rejects.toThrow(/Recorder plugin is not registered/);
  });

  it("does NOT call console.warn or console.error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    controls.start();
    controls.stop();
    controls.toggle();
    controls.clear();
    controls.isCapturing();
    await controls.copyJson().catch(() => {});
    await controls.copyText().catch(() => {});
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });
});

describe("recorderPlugin.setup — controller lifecycle", () => {
  beforeEach(() => {
    cleanupPlugin();
    cleanupPlugin();
  });

  it("setup() makes isCapturing observable as a real boolean", () => {
    recorderPlugin.setup?.(stubApi as ReactGrabAPI, {} as never);
    expect(controls.isCapturing()).toBe(false);
    controls.start();
    expect(controls.isCapturing()).toBe(true);
    controls.stop();
    expect(controls.isCapturing()).toBe(false);
  });

  it("cleanup() returns the proxy to no-controller behavior", async () => {
    const config = recorderPlugin.setup?.(stubApi as ReactGrabAPI, {} as never);
    controls.start();
    config?.cleanup?.();
    expect(controls.isCapturing()).toBe(false);
    await expect(controls.copyJson()).rejects.toThrow(/not registered/);
  });

  it("register → unregister → re-register produces a fresh controller", () => {
    const c1 = recorderPlugin.setup?.(stubApi as ReactGrabAPI, {} as never);
    controls.start();
    c1?.cleanup?.();

    recorderPlugin.setup?.(stubApi as ReactGrabAPI, {} as never);
    expect(controls.isCapturing()).toBe(false); // fresh controller, not capturing
  });

  it("registers exactly one ContextMenuAction with id recorder.info", () => {
    const config = recorderPlugin.setup?.(stubApi as ReactGrabAPI, {} as never);
    const ids = (config?.actions ?? []).map((a) => a.id);
    expect(ids).toContain("recorder.info");
    config?.cleanup?.();
  });

  it("recorder.info onAction does not throw", () => {
    const config = recorderPlugin.setup?.(stubApi as ReactGrabAPI, {} as never);
    const action = config?.actions?.find((a) => a.id === "recorder.info");
    expect(action).toBeDefined();
    // jsdom has window.open as a no-op stub; just call it.
    expect(() => action!.onAction({} as never)).not.toThrow();
    config?.cleanup?.();
  });
});

describe("recorderPlugin metadata", () => {
  it("plugin name is 'recorder'", () => {
    expect(recorderPlugin.name).toBe("recorder");
  });
});

describe("recorderPlugin — end-to-end capture-to-export round-trip", () => {
  let originalExecCommand: typeof document.execCommand | undefined;
  let capturedClipboard = "";

  beforeEach(() => {
    cleanupPlugin();
    cleanupPlugin();
    capturedClipboard = "";
    document.body.innerHTML = "";

    // jsdom does not implement document.execCommand("copy"). Stub it directly
    // (vi.spyOn fails because the property does not exist). Mirror the
    // synthetic copy event that copy-content.ts uses in production.
    originalExecCommand = document.execCommand;
    (document as unknown as { execCommand: typeof document.execCommand }).execCommand =
      vi.fn(() => {
        const evt = new Event("copy") as ClipboardEvent;
        Object.defineProperty(evt, "clipboardData", {
          value: {
            setData: (mime: string, value: string) => {
              if (mime === "text/plain") capturedClipboard = value;
            },
            getData: (mime: string) =>
              mime === "text/plain" ? capturedClipboard : "",
          },
        });
        document.dispatchEvent(evt);
        return true;
      }) as typeof document.execCommand;
  });

  afterEach(() => {
    if (originalExecCommand !== undefined) {
      document.execCommand = originalExecCommand;
    } else {
      delete (document as unknown as { execCommand?: unknown }).execCommand;
    }
  });

  it("dispatched pointerdown survives through to copyJson output", async () => {
    recorderPlugin.setup?.(stubApi as ReactGrabAPI, {} as never);

    const button = document.createElement("button");
    button.id = "go";
    document.body.appendChild(button);

    controls.start();

    const event = new PointerEvent("pointerdown", { bubbles: true });
    Object.defineProperty(event, "target", { value: button });
    Object.defineProperty(event, "offsetX", { value: 0 });
    Object.defineProperty(event, "offsetY", { value: 0 });
    document.dispatchEvent(event);

    controls.stop();
    await controls.copyJson();

    const flow = JSON.parse(capturedClipboard);
    expect(flow.steps).toBeDefined();
    expect(flow.steps[0].type).toBe("setViewport");
    expect(flow.steps[1].type).toBe("navigate");
    const clickStep = flow.steps.find(
      (s: { type: string }) => s.type === "click",
    );
    expect(clickStep).toBeDefined();
    expect(clickStep.selectors).toBeDefined();
    expect(clickStep.selectors[0]).toBeInstanceOf(Array);
  });

  it("dispatched change survives through to copyText output", async () => {
    recorderPlugin.setup?.(stubApi as ReactGrabAPI, {} as never);

    const input = document.createElement("input");
    input.id = "email";
    input.value = "doruk@example.com";
    document.body.appendChild(input);

    controls.start();
    const event = new Event("change", { bubbles: true });
    Object.defineProperty(event, "target", { value: input });
    document.dispatchEvent(event);
    controls.stop();

    await controls.copyText();

    expect(capturedClipboard).toMatch(/Type "doruk@example\.com" into/);
  });

  it("clear() empties the buffer end-to-end (no steps in subsequent export)", async () => {
    recorderPlugin.setup?.(stubApi as ReactGrabAPI, {} as never);

    const button = document.createElement("button");
    document.body.appendChild(button);
    controls.start();
    const event = new PointerEvent("pointerdown", { bubbles: true });
    Object.defineProperty(event, "target", { value: button });
    Object.defineProperty(event, "offsetX", { value: 0 });
    Object.defineProperty(event, "offsetY", { value: 0 });
    document.dispatchEvent(event);

    controls.clear();
    await controls.copyJson();

    const flow = JSON.parse(capturedClipboard);
    // Only the two implicit header steps should remain.
    expect(flow.steps).toHaveLength(2);
    expect(flow.steps[0].type).toBe("setViewport");
    expect(flow.steps[1].type).toBe("navigate");
  });
});
