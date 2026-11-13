import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";
import { apiAuthHeaders, getApiBaseUrl } from "../../generated/custom-fetch.js";

/**
 * An `<img>` cannot send an Authorization header, and the sync server now
 * requires one (ADR-0020). For a URL on the sync server this fetches the image
 * with the token and returns a blob URL to display instead; any other URL is
 * returned unchanged. The blob URL is released when the source changes or the
 * component goes away.
 *
 * External bridge (network → signal), so a single-purpose effect is the right
 * primitive here.
 */
export const useAuthenticatedImageUrl = (
  src: Accessor<string | undefined>,
): Accessor<string | undefined> => {
  const [displayUrl, setDisplayUrl] = createSignal<string | undefined>();

  createEffect(() => {
    const url = src();
    const baseUrl = getApiBaseUrl();
    if (!url || !baseUrl || !url.startsWith(baseUrl)) {
      setDisplayUrl(url);
      return;
    }

    setDisplayUrl(undefined);
    let released = false;
    let objectUrl: string | undefined;

    fetch(url, { headers: apiAuthHeaders() })
      .then((response) => {
        if (!response.ok)
          throw new Error(`GET screenshot failed: ${response.status}`);
        return response.blob();
      })
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
