import type { Component } from "solid-js";
import type { OverlayBounds } from "../../types.js";

const DOT_SIZE_PX = 10;
const DOT_GAP_PX = 4;

interface CollapsedDotProps {
  selectionBounds: OverlayBounds;
  onExpand: () => void;
}

export const CollapsedDot: Component<CollapsedDotProps> = (props) => {
  const position = () => {
    const bounds = props.selectionBounds;
    return {
      left: bounds.x + bounds.width / 2,
      top: bounds.y + bounds.height + DOT_GAP_PX,
    };
  };

  return (
    <button
      type="button"
      data-react-grab-ignore-events
      data-react-grab-collapsed-dot
      title="Expand"
      class="fixed flex items-center justify-center rounded-full bg-popover border border-border shadow-md cursor-pointer transition-all duration-150 ease-out hover:bg-accent hover:border-ring hover:shadow-lg hover:scale-110 p-[6px]"
      style={{
        left: `${position().left}px`,
        top: `${position().top}px`,
        transform: "translateX(-50%)",
        "z-index": "var(--z-overlay)",
        "pointer-events": "auto",
      }}
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
  );
};
