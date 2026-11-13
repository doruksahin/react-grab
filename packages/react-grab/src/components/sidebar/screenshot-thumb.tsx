import { type Component, Show } from "solid-js";
import { useLazyVisible } from "../../features/sidebar/index.js";
import { useAuthenticatedImageUrl } from "../../features/screenshot/index.js";

interface ScreenshotThumbProps {
  /** Screenshot URL on the sync server. */
  src: string;
  label: "Element" | "Full page";
  class: string;
  /** Opens the screenshot larger; receives the URL that is actually displayed. */
  onOpen?: (displayedSrc: string, label: string) => void;
}

/**
 * A small screenshot thumbnail. Loads only once it scrolls into view, and
 * fetches with the API token because the sync server requires it (ADR-0020).
 */
export const ScreenshotThumb: Component<ScreenshotThumbProps> = (props) => {
  let containerRef: HTMLSpanElement | undefined;
  const visible = useLazyVisible(() => containerRef);
  const imageUrl = useAuthenticatedImageUrl(() =>
    visible() ? props.src : undefined,
  );

  return (
    <span ref={containerRef} class="inline-flex">
      <Show
        when={imageUrl()}
        fallback={<span class={`${props.class} block animate-pulse`} />}
      >
        {(url) => (
          <img
            data-react-grab-screenshot-thumb
            src={url()}
            alt={`${props.label} screenshot`}
            class={props.class}
            onClick={
              props.onOpen
                ? () => props.onOpen?.(url(), props.label)
                : undefined
            }
          />
        )}
      </Show>
    </span>
  );
};
