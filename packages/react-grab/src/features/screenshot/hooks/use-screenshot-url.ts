import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";
import { useSyncContext } from "../../sync/sync-context.js";
import type { ScreenshotRef } from "../types.js";

/**
 * A displayable URL for an uploaded screenshot. An `<img>` cannot send the
 * token the sync server requires (ADR-0020), so the image is loaded through
 * the storage port and shown from a blob URL. The blob URL is released when
 * the screenshot changes or the component goes away.
 *
 * External bridge (port → signal), so a single-purpose effect is the right
 * primitive here.
 */
export const useScreenshotUrl = (
  screenshot: Accessor<ScreenshotRef | undefined>,
): Accessor<string | undefined> => {
  const { storage } = useSyncContext();
  const [displayUrl, setDisplayUrl] = createSignal<string | undefined>();

  createEffect(() => {
    const target = screenshot();
    const port = storage();
    setDisplayUrl(undefined);
    if (!target || !port) return;

    let released = false;
    let objectUrl: string | undefined;

    port
      .loadScreenshot(target.selectionId, target.kind)
      .then((blob) => {
        if (released) return;
        objectUrl = URL.createObjectURL(blob);
        setDisplayUrl(objectUrl);
      })
      .catch(() => {
        // Leave the slot empty; the card still shows everything else.
      });

    onCleanup(() => {
      released = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    });
  });

  return displayUrl;
};
