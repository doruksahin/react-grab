import { Show, createSignal } from "solid-js";
import type { Component, ParentComponent } from "solid-js";
import type { OverlayBounds } from "../../types.js";
import { cn } from "../../utils/cn.js";
import { Button } from "../ui/button.js";
import { createFloating, virtualReference } from "../../utils/floating.js";

const DOT_SIZE_PX = 10;
const DOT_GAP_PX = 6;
const DOT_OFFSCREEN_PX = -9999;
const DOT_PADDING_PX = 6;
const PREVIEW_MAX_LENGTH = 48;

/** Total height of the dot-only button (no preview text). */
export const DOT_BUTTON_HEIGHT_PX = DOT_SIZE_PX + DOT_PADDING_PX * 2;
/** Vertical space the dot occupies below selection bounds (gap + button). */
export const DOT_TOTAL_OFFSET_PX = DOT_GAP_PX + DOT_BUTTON_HEIGHT_PX;

interface CollapsedDotProps {
  selectionBounds: OverlayBounds;
  onExpand: () => void;
  inputValue?: string;
  isExpanding?: boolean;
  placement?: "above" | "below";
}

const toPreview = (value: string): string => {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= PREVIEW_MAX_LENGTH) return collapsed;
  return collapsed.slice(0, PREVIEW_MAX_LENGTH).trimEnd() + "…";
};

/* ── Slots ────────────────────────────────────────────────── */

const DotIndicator: Component = () => (
  <div
    class="rounded-full bg-primary shrink-0"
    style={{ width: `${DOT_SIZE_PX}px`, height: `${DOT_SIZE_PX}px` }}
  />
);

const PreviewSlot: ParentComponent = (props) => (
  <span
    data-react-grab-collapsed-dot-preview
    class="min-w-0 truncate text-meta leading-tight text-popover-foreground"
  >
    {props.children}
  </span>
);

/* ── Shell ────────────────────────────────────────────────── */

export const CollapsedDot: Component<CollapsedDotProps> = (props) => {
  // Centred above or below its element (the side follows the label it
  // replaces); shifted along the edge to stay inside the viewport.
  const [dot, setDot] = createSignal<HTMLButtonElement>();
  const floatingPosition = createFloating({
    reference: () => {
      const bounds = props.selectionBounds;
      return virtualReference(() => bounds);
    },
    floating: dot,
    options: () => {
      const placement = props.placement === "above" ? "top" : "bottom";
      return {
        placement,
        fallbackPlacements: [placement],
        offsetPx: DOT_GAP_PX,
        paddingPx: DOT_GAP_PX,
      };
    },
  });
  const position = () => ({
    left: floatingPosition()?.x ?? DOT_OFFSCREEN_PX,
    top: floatingPosition()?.y ?? DOT_OFFSCREEN_PX,
  });

  const previewText = () => {
    const raw = props.inputValue;
    if (!raw) return null;
    const preview = toPreview(raw);
    return preview.length > 0 ? preview : null;
  };

  const hasPreview = () => Boolean(previewText());

  return (
    <Button
      ref={setDot}
      type="button"
      variant="outline"
      data-react-grab-ignore-events
      data-react-grab-collapsed-dot
      class={cn(
        "fixed h-auto rounded-full bg-popover shadow-md transition-all duration-150 ease-out hover:scale-105 hover:border-ring hover:shadow-lg",
        hasPreview() ? "justify-between gap-3 pl-3 pr-1.5 py-1" : "p-1.5",
        props.isExpanding
          ? "animate-out fade-out-0 zoom-out-75 fill-mode-forwards ease-in"
          : "animate-in fade-in-0 zoom-in-75 ease-out",
      )}
      style={{
        left: `${position().left}px`,
        top: `${position().top}px`,
        "z-index": "var(--z-overlay)",
        "pointer-events": "auto",
        "max-width": "240px",
      }}
      onClick={(event) => {
        event.stopImmediatePropagation();
        props.onExpand();
      }}
      onPointerDown={(event) => event.stopImmediatePropagation()}
    >
      <Show when={previewText()}>
        {(text) => <PreviewSlot>{text()}</PreviewSlot>}
      </Show>

      <DotIndicator />
    </Button>
  );
};
