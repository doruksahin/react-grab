import { record } from "@rrweb/record";
import type { RecordingConfig } from "../../types.js";
import type { StorageAdapter } from "../sync/types.js";
import { createRecentWindow } from "./business/recent-window.js";
import { gzipJson } from "./business/gzip-json.js";

const DEFAULT_WINDOW_MINUTES = 5;
const CANVAS_FRAMES_PER_SECOND = 2;
const CANVAS_IMAGE_QUALITY = 0.6;
const MS_PER_MINUTE = 60_000;

export interface SessionRecorder {
  /** Uploads the recent window for a comment; resolves to its link, or undefined when it cannot be stored. */
  saveFor: (
    commentId: string,
    adapter: StorageAdapter | null,
  ) => Promise<string | undefined>;
  stop: () => void;
}

/**
 * Records the page in the background with rrweb and keeps the last few
 * minutes (SPEC-020, ADR-0021). Options follow rrweb's guide: checkout for the
 * window, canvas as low-rate WebP snapshots, every input masked, and the
 * overlay's own host left out.
 */
export const createSessionRecorder = (
  config: RecordingConfig,
): SessionRecorder => {
  const recentWindow = createRecentWindow<unknown>();
  const stopRecording = record({
    emit: (event, isCheckout) => recentWindow.add(event, Boolean(isCheckout)),
    checkoutEveryNms:
      (config.windowMinutes ?? DEFAULT_WINDOW_MINUTES) * MS_PER_MINUTE,
    recordCanvas: true,
    sampling: { canvas: CANVAS_FRAMES_PER_SECOND },
    dataURLOptions: { type: "image/webp", quality: CANVAS_IMAGE_QUALITY },
    maskAllInputs: true,
    blockSelector: "[data-react-grab-ignore]",
  });

  return {
    saveFor: async (commentId, adapter) => {
      if (!adapter?.uploadRecording) return undefined;
      try {
        return await adapter.uploadRecording(
          commentId,
          await gzipJson(recentWindow.take()),
        );
      } catch {
        // Best effort, like screenshots: a failed upload never blocks the comment.
        return undefined;
      }
    },
    stop: () => stopRecording?.(),
  };
};
