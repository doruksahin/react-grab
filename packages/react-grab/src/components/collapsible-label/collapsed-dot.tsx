import { Show } from "solid-js";
import type { Component } from "solid-js";
import type { OverlayBounds } from "../../types.js";

const DOT_SIZE_PX = 10;
const DOT_GAP_PX = 4;
const PREVIEW_MAX_LENGTH = 48;

interface CollapsedDotProps {
  selectionBounds: OverlayBounds;
  onExpand: () => void;
  inputValue?: string;
  isExpanding?: boolean;
}

const toPreview = (value: string): string => {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= PREVIEW_MAX_LENGTH) return collapsed;
  return collapsed.slice(0, PREVIEW_MAX_LENGTH).trimEnd() + "…";
};

export const CollapsedDot: Component<CollapsedDotProps> = (props) => {
  const position = () => {
    const bounds = props.selectionBounds;
    return {
      left: bounds.x + bounds.width / 2,
      top: bounds.y + bounds.height + DOT_GAP_PX,
    };
  };

  const previewText = () => {
    const raw = props.inputValue;
    if (!raw) return null;
    const preview = toPreview(raw);
    return preview.length > 0 ? preview : null;
  };

  return (
    <div
      class={`fixed duration-150 ease-in ${props.isExpanding ? "animate-out fade-out-0 zoom-out-75 fill-mode-forwards" : "animate-in fade-in-0 zoom-in-75 ease-out"}`}
      style={{
        left: `${position().left}px`,
        top: `${position().top}px`,
        translate: "-50% 0",
        "z-index": "var(--z-overlay)",
        "pointer-events": "none",
      }}
    >
      <Show when={previewText()}>
        {(text) => (
          <div
            data-react-grab-ignore-events
            data-react-grab-collapsed-dot-preview
            class="absolute top-1/2 right-[calc(100%+6px)] -translate-y-1/2 px-2 py-1 rounded-full bg-popover/95 border border-border/60 shadow-sm backdrop-blur-sm max-w-[220px] whitespace-nowrap pointer-events-none text-[11px] text-popover-foreground truncate"
          >
            {text()}
          </div>
        )}
      </Show>

      <button
        type="button"
        data-react-grab-ignore-events
        data-react-grab-collapsed-dot
        title="Expand"
        class="pointer-events-auto flex items-center justify-center rounded-full bg-popover border border-border shadow-md cursor-pointer transition-all duration-150 ease-out hover:bg-accent hover:border-ring hover:shadow-lg hover:scale-110 p-[6px]"
        onClick={(event) => {
          event.stopImmediatePropagation();
          props.onExpand();
        }}
        onPointerDown={(event) => event.stopImmediatePropagation()}
      >
        <div
          class="rounded-full bg-primary"
          style={{
            width: `${DOT_SIZE_PX}px`,
            height: `${DOT_SIZE_PX}px`,
          }}
        />
      </button>
    </div>
  );
};
