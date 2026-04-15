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
    <div
      data-react-grab-ignore-events
      data-react-grab-collapsed-dot
      class="fixed cursor-pointer transition-transform duration-150 ease-out hover:scale-150"
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
    </div>
  );
};
