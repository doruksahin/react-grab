import type { ScreenshotConfig } from "../../types.js";
import type { StorageAdapter } from "../sync/types.js";
import { captureElement, captureFullPage } from "./capture.js";

interface ScreenshotResult {
  screenshotElement?: string | null;
  screenshotFullPage?: string | null;
}

/**
 * Captures screenshots for a selection and uploads them.
 * Returns the storage keys to patch onto the CommentItem.
 * Fire-and-forget — failures return null keys silently.
 */
export async function captureAndUploadScreenshots(
  element: Element,
  selectionId: string,
  config: ScreenshotConfig,
  adapter: StorageAdapter | null,
): Promise<ScreenshotResult> {
  const result: ScreenshotResult = {
    screenshotElement: null,
    screenshotFullPage: null,
  };

  // Capture element screenshot
  const elementBlob = await captureElement(element, config);
  if (elementBlob) {
    if (adapter?.uploadScreenshot) {
      try {
        result.screenshotElement = await adapter.uploadScreenshot(
          selectionId,
          "element",
          elementBlob,
        );
      } catch {
        // Silent fail — screenshot is best-effort
      }
    } else {
      // Local-only mode: use blob URL
      result.screenshotElement = URL.createObjectURL(elementBlob);
    }
  }

  // Capture full page screenshot
  if (config.captureFullPage !== false) {
    const fullPageBlob = await captureFullPage(config);
    if (fullPageBlob) {
      if (adapter?.uploadScreenshot) {
        try {
          result.screenshotFullPage = await adapter.uploadScreenshot(
            selectionId,
            "full",
            fullPageBlob,
          );
        } catch {
          // Silent fail
        }
      } else {
        result.screenshotFullPage = URL.createObjectURL(fullPageBlob);
      }
    }
  }

  return result;
}
