import { domToBlob, domToCanvas } from "modern-screenshot";
import type { ScreenshotConfig } from "../../types.js";

const OVERLAY_SELECTOR = "[data-react-grab]";

const defaultConfig: Required<Omit<ScreenshotConfig, "enabled">> = {
  scale: 2,
  quality: 0.8,
  captureFullPage: true,
  elementPadding: 16,
  format: "png",
  maxWidth: 1920,
  maxHeight: 1080,
};

function resolveConfig(
  config: ScreenshotConfig,
): Required<Omit<ScreenshotConfig, "enabled">> {
  return { ...defaultConfig, ...config };
}

function isReactGrabElement(node: Node): boolean {
  if (node instanceof HTMLElement) {
    return node.closest(OVERLAY_SELECTOR) !== null;
  }
  return false;
}

/**
 * Draws the element highlight rect directly onto an already-rendered canvas.
 * Invisible to the user — no DOM overlay is ever injected.
 */
export function drawHighlightOnCanvas(
  canvas: HTMLCanvasElement,
  element: Element,
  config: ScreenshotConfig,
): void {
  const { scale } = resolveConfig(config);
  const rect = element.getBoundingClientRect();
  const absLeft = (rect.left + window.scrollX) * scale;
  const absTop = (rect.top + window.scrollY) * scale;
  const width = (element as HTMLElement).offsetWidth * scale;
  const height = (element as HTMLElement).offsetHeight * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  ctx.fillStyle = "rgba(245, 158, 11, 0.15)";
  ctx.fillRect(absLeft, absTop, width, height);
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 3 * scale;
  ctx.strokeRect(absLeft, absTop, width, height);
  ctx.restore();
}

/**
 * Renders the full page to a canvas. Used as the single render pass from which
 * both the full-page blob and the element crop are derived.
 * The element highlight is drawn post-render directly on the canvas — never visible to the user.
 */
export async function capturePageCanvas(
  config: ScreenshotConfig,
  element: Element,
): Promise<HTMLCanvasElement | null> {
  const resolved = resolveConfig(config);
  try {
    const canvas = await domToCanvas(document.documentElement, {
      scale: resolved.scale,
      quality: resolved.quality,
      type: resolved.format === "jpeg" ? "image/jpeg" : "image/png",
      width: Math.min(document.documentElement.scrollWidth, resolved.maxWidth),
      height: Math.min(
        document.documentElement.scrollHeight,
        resolved.maxHeight,
      ),
      filter: (node: Node) => !isReactGrabElement(node),
    });
    return canvas;
  } catch {
    return null;
  }
}

/** Converts a canvas to a blob using the resolved format/quality. */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  config: ScreenshotConfig,
): Promise<Blob | null> {
  const resolved = resolveConfig(config);
  const mimeType = resolved.format === "jpeg" ? "image/jpeg" : "image/png";
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, resolved.quality);
  });
}

/**
 * Crops the element region out of an already-rendered full-page canvas.
 * Adds padding on all sides (clamped to canvas bounds).
 * This gives a pixel-accurate element screenshot with correct background colors.
 */
export function cropElementFromCanvas(
  canvas: HTMLCanvasElement,
  element: Element,
  config: ScreenshotConfig,
): Promise<Blob | null> {
  const resolved = resolveConfig(config);
  const { scale, elementPadding: padding, format, quality } = resolved;

  const rect = element.getBoundingClientRect();
  const absLeft = rect.left + window.scrollX;
  const absTop = rect.top + window.scrollY;

  const sx = Math.max(0, Math.round((absLeft - padding) * scale));
  const sy = Math.max(0, Math.round((absTop - padding) * scale));
  const sw = Math.min(
    Math.round((rect.width + 2 * padding) * scale),
    canvas.width - sx,
  );
  const sh = Math.min(
    Math.round((rect.height + 2 * padding) * scale),
    canvas.height - sy,
  );

  if (sw <= 0 || sh <= 0) return Promise.resolve(null);

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = sw;
  cropCanvas.height = sh;
  const ctx = cropCanvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);

  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

  const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
  return new Promise((resolve) => {
    cropCanvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

// --- Backward-compatible standalone exports ---

/** @deprecated Prefer capturePageCanvas + cropElementFromCanvas for correct backgrounds. */
export async function captureElement(
  element: Element,
  config: ScreenshotConfig,
): Promise<Blob | null> {
  const resolved = resolveConfig(config);
  try {
    return await domToBlob(element as HTMLElement, {
      scale: resolved.scale,
      quality: resolved.quality,
      type: resolved.format === "jpeg" ? "image/jpeg" : "image/png",
      filter: (node: Node) => !isReactGrabElement(node),
      width: Math.min((element as HTMLElement).offsetWidth, resolved.maxWidth),
      height: Math.min(
        (element as HTMLElement).offsetHeight,
        resolved.maxHeight,
      ),
    });
  } catch {
    return null;
  }
}

export async function captureFullPage(
  config: ScreenshotConfig,
  element: Element,
): Promise<Blob | null> {
  const canvas = await capturePageCanvas(config, element);
  if (!canvas) return null;
  return canvasToBlob(canvas, config);
}
