// packages/react-grab/src/components/sidebar/screenshot-pair.tsx
import { type Component, Show } from "solid-js";
import { useLazyVisible } from "../../features/sidebar";
import { useImageLightbox } from "../../features/image-lightbox/index.js";

interface ScreenshotPairProps {
  /** Constructed screenshot URL (not an R2 key) — undefined if sync is disabled or key absent */
  elementSrc?: string;
  /** Constructed screenshot URL (not an R2 key) — undefined if sync is disabled or key absent */
  fullPageSrc?: string;
  /** The scroll container — required for correct IntersectionObserver root */
  scrollRoot: () => Element | null;
}

const ScreenshotSlot: Component<{
  src?: string;
  label: string;
  scrollRoot: () => Element | null;
}> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  const visible = useLazyVisible(() => containerRef, props.scrollRoot);
  const lightbox = useImageLightbox();

  return (
    <div class="flex-1 min-w-0" ref={containerRef}>
      <div class="text-[9px] text-muted-foreground mb-0.5">{props.label}</div>
      <Show
        when={visible()}
        fallback={<div class="w-full h-20 rounded animate-pulse bg-muted" />}
      >
        <Show
          when={props.src}
          fallback={
            <div class="w-full h-8 rounded bg-muted flex items-center justify-center text-[9px] text-muted-foreground italic">
              No {props.label.toLowerCase()} screenshot
            </div>
          }
        >
          <img
            data-react-grab-screenshot-thumb
            src={props.src}
            alt={`${props.label} screenshot`}
            class="w-full rounded border border-border object-contain max-h-32 cursor-zoom-in hover:border-primary/60 transition-colors"
            loading="lazy"
            onClick={() => {
              if (props.src) lightbox.open(props.src, props.label);
            }}
          />
        </Show>
      </Show>
    </div>
  );
};

export const ScreenshotPair: Component<ScreenshotPairProps> = (props) => {
  return (
    <div data-react-grab-screenshot-pair class="flex gap-2 mt-1.5" style={{ "pointer-events": "auto" }}>
      <ScreenshotSlot
        src={props.elementSrc}
        label="Element"
        scrollRoot={props.scrollRoot}
      />
      <ScreenshotSlot
        src={props.fullPageSrc}
        label="Full page"
        scrollRoot={props.scrollRoot}
      />
    </div>
  );
};
