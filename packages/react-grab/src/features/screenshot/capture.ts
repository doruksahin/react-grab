import { domToBlob } from "modern-screenshot";
import type { ScreenshotConfig } from "../../types.js";

const OVERLAY_SELECTOR = "[data-react-grab]";

const defaultConfig: Required<Omit<ScreenshotConfig, "enabled">> = {
  scale: 2,
  quality: 0.8,
  captureFullPage: true,
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

export async function captureElement(
  element: Element,
  config: ScreenshotConfig,
): Promise<Blob | null> {
  const resolved = resolveConfig(config);
  try {
    const blob = await domToBlob(element as HTMLElement, {
      scale: resolved.scale,
      quality: resolved.quality,
      type: resolved.format === "jpeg" ? "image/jpeg" : "image/png",
      filter: (node: Node) => !isReactGrabElement(node),
      width: Math.min((element as HTMLElement).offsetWidth, resolved.maxWidth),
      height: Math.min((element as HTMLElement).offsetHeight, resolved.maxHeight),
    });
    return blob;
  } catch {
    return null;
  }
}

export async function captureFullPage(
  config: ScreenshotConfig,
): Promise<Blob | null> {
  const resolved = resolveConfig(config);
  try {
    const blob = await domToBlob(document.documentElement, {
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
    return blob;
  } catch {
    return null;
  }
}
