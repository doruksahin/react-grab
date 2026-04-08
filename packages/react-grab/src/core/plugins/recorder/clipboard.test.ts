// packages/react-grab/src/core/plugins/recorder/clipboard.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeRecordingToClipboard } from "./clipboard.js";

describe("writeRecordingToClipboard", () => {
  // jsdom does not define document.execCommand at all — we cannot vi.spyOn it.
  // Instead, replace the property directly, then restore in afterEach.
  let originalExecCommand: typeof document.execCommand | undefined;
  let execCommandMock: ReturnType<typeof vi.fn>;
  let capturedText = "";

  beforeEach(() => {
    capturedText = "";
    document.body.innerHTML = "";
    originalExecCommand = document.execCommand;

    execCommandMock = vi.fn(() => {
      // Simulate the synthetic copy event the production wrapper relies on:
      // dispatch a copy event so the listener installed by clipboard.ts fires
      // and writes to clipboardData.
      const evt = new Event("copy") as ClipboardEvent;
      Object.defineProperty(evt, "clipboardData", {
        value: {
          setData: (mime: string, value: string) => {
            if (mime === "text/plain") capturedText = value;
          },
          getData: (mime: string) =>
            mime === "text/plain" ? capturedText : "",
        },
      });
      document.dispatchEvent(evt);
      return true;
    });

    (document as unknown as { execCommand: typeof document.execCommand }).execCommand =
      execCommandMock as unknown as typeof document.execCommand;
  });

  afterEach(() => {
    if (originalExecCommand !== undefined) {
      (document as unknown as { execCommand: typeof document.execCommand }).execCommand =
        originalExecCommand;
    } else {
      delete (document as unknown as { execCommand?: unknown }).execCommand;
    }
  });

  it("calls execCommand('copy') with the content payload", () => {
    const result = writeRecordingToClipboard("hello world");
    expect(execCommandMock).toHaveBeenCalledWith("copy");
    expect(capturedText).toBe("hello world");
    expect(result).toBe(true);
  });

  it("removes the temporary textarea after writing", () => {
    writeRecordingToClipboard("payload");
    const stragglers = document.querySelectorAll('textarea[aria-hidden="true"]');
    expect(stragglers.length).toBe(0);
  });

  it("returns false when execCommand is unavailable", () => {
    delete (document as unknown as { execCommand?: unknown }).execCommand;
    expect(writeRecordingToClipboard("x")).toBe(false);
  });
});
