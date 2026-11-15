import { type Component, Show } from "solid-js";
import { useLazyVisible } from "../../features/sidebar/index.js";
import {
  useScreenshotUrl,
  type ScreenshotRef,
} from "../../features/screenshot/index.js";

interface ScreenshotThumbProps {
  screenshot: ScreenshotRef;
  label: "Element" | "Full page";
  class: string;
  /** Opens the screenshot larger; receives the URL that is actually displayed. */
  onOpen?: (displayedSrc: string, label: string) => void;
}

/**
 * A small screenshot thumbnail. Loads through the storage port only once it
 * scrolls into view.
 */
export const ScreenshotThumb: Component<ScreenshotThumbProps> = (props) => {
  let containerRef: HTMLSpanElement | undefined;
  const visible = useLazyVisible(() => containerRef);
  const imageUrl = useScreenshotUrl(() =>
    visible() ? props.screenshot : undefined,
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
