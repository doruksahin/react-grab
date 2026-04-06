import type { CommentItem, ScreenshotConfig } from "../../types.js";
import type { StorageAdapter } from "../sync/types.js";
import {
  capturePageCanvas,
  canvasToBlob,
  cropElementFromCanvas,
  drawHighlightOnCanvas,
} from "./capture.js";

type ScreenshotResult = Pick<CommentItem, "screenshotElement" | "screenshotFullPage">;

/**
 * Captures screenshots for a selection and uploads them.
 * Renders the full page once, then derives both the element crop and full-page
 * blob from the same canvas pass.
 * Fire-and-forget — failures return null keys silently.
 */
export async function captureAndUploadScreenshots(
  element: Element,
  selectionId: string,
  config: ScreenshotConfig,
  adapter: StorageAdapter | null,
): Promise<ScreenshotResult> {
  const result: ScreenshotResult = {};

  const canvas = await capturePageCanvas(config, element);
  if (!canvas) return result;

  // Element crop — before highlight so the selected element shot is clean
  const elementBlob = await cropElementFromCanvas(canvas, element, config);
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
      result.screenshotElement = URL.createObjectURL(elementBlob);
    }
  }

  // Full-page blob — draw highlight first, then export
  if (config.captureFullPage !== false) {
    drawHighlightOnCanvas(canvas, element, config);
    const fullPageBlob = await canvasToBlob(canvas, config);
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
