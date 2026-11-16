// packages/react-grab/src/components/sidebar/screenshot-pair.tsx
import { type Component, Show } from "solid-js";
import { useLazyVisible } from "../../features/sidebar/index.js";
import { useImageLightbox } from "../../features/image-lightbox/index.js";
import {
  useScreenshotUrl,
  type ScreenshotRef,
} from "../../features/screenshot/index.js";

interface ScreenshotPairProps {
  /** Undefined when the selection has no element screenshot */
  element?: ScreenshotRef;
  /** Undefined when the selection has no full-page screenshot */
  fullPage?: ScreenshotRef;
  /** The scroll container — required for correct IntersectionObserver root */
  scrollRoot: () => Element | null;
}

const ScreenshotSlot: Component<{
  screenshot?: ScreenshotRef;
  label: string;
  scrollRoot: () => Element | null;
}> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  const visible = useLazyVisible(() => containerRef, props.scrollRoot);
  const lightbox = useImageLightbox();
  // Load only once the slot is on screen.
  const imageUrl = useScreenshotUrl(() =>
    visible() ? props.screenshot : undefined,
  );

  return (
    <div class="flex-1 min-w-0" ref={containerRef}>
      <div class="text-meta text-muted-foreground mb-0.5">{props.label}</div>
      <Show
        when={visible()}
        fallback={<div class="w-full h-20 rounded animate-pulse bg-muted" />}
      >
        <Show
          when={props.screenshot}
          fallback={
            <div class="w-full h-8 rounded bg-muted flex items-center justify-center text-meta text-muted-foreground italic">
              No {props.label.toLowerCase()} screenshot
            </div>
          }
        >
          <Show
            when={imageUrl()}
            fallback={
              <div class="w-full h-20 rounded animate-pulse bg-muted" />
            }
          >
            {(url) => (
              <img
                data-react-grab-screenshot-thumb
                src={url()}
                alt={`${props.label} screenshot`}
                class="w-full rounded border border-border object-contain max-h-32 cursor-zoom-in hover:border-primary/60 transition-colors"
                onClick={() => lightbox.open(url(), props.label)}
              />
            )}
          </Show>
        </Show>
      </Show>
    </div>
  );
};

export const ScreenshotPair: Component<ScreenshotPairProps> = (props) => {
  return (
    <div
      data-react-grab-screenshot-pair
      class="flex gap-2 mt-1.5"
      style={{ "pointer-events": "auto" }}
    >
      <ScreenshotSlot
        screenshot={props.element}
        label="Element"
        scrollRoot={props.scrollRoot}
      />
      <ScreenshotSlot
        screenshot={props.fullPage}
        label="Full page"
        scrollRoot={props.scrollRoot}
      />
    </div>
  );
};
