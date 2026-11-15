import { Show, createSignal } from "solid-js";
import type { Component } from "solid-js";
import type { OverlayBounds } from "../../types.js";
import { createFloating, virtualReference } from "../../utils/floating.js";
import { PIN_GAP_PX, PIN_HEIGHT_PX } from "../../constants.js";
import { Pin, PinKey, PinText } from "../ui/pin.js";
import { StatusDot } from "../ui/status-dot.js";

const PREVIEW_MAX_LENGTH = 48;

/** Vertical space a pin takes below its element (gap + pin). */
export const PIN_TOTAL_OFFSET_PX = PIN_GAP_PX + PIN_HEIGHT_PX;

interface CollapsedDotProps {
  selectionBounds: OverlayBounds;
  onExpand: () => void;
  /** The comment; its first words show on the pin. */
  inputValue?: string;
  /** The ticket key, e.g. "ATT-101". */
  ticketKey?: string;
  /** The status dot's colour (features/sidebar/status-colors.ts). */
  statusColor: string;
  /** Whether the card it opens is showing. */
  expanded: boolean;
  /** How far below its own spot the pin sits, so it does not cover another pin. */
  stackOffsetPx: number;
}

const toPreview = (value: string): string => {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= PREVIEW_MAX_LENGTH) return collapsed;
  return collapsed.slice(0, PREVIEW_MAX_LENGTH).trimEnd() + "…";
};

/** A saved comment on the page: a pin under its element's left edge. */
export const CollapsedDot: Component<CollapsedDotProps> = (props) => {
  // Below the element's left edge, moved down by the stack offset and kept
  // inside the viewport along the edge.
  const [pin, setPin] = createSignal<HTMLButtonElement>();
  const pinReference = virtualReference(() => props.selectionBounds);
  const floating = createFloating({
    reference: () => pinReference,
    floating: pin,
    watch: () => [props.selectionBounds, props.stackOffsetPx],
    options: () => ({
      placement: "bottom-start",
      flip: false,
      offsetPx: PIN_GAP_PX + props.stackOffsetPx,
      paddingPx: PIN_GAP_PX,
    }),
  });

  const previewText = () => {
    const raw = props.inputValue;
    if (!raw) return null;
    const preview = toPreview(raw);
    return preview.length > 0 ? preview : null;
  };

  return (
    <Pin
      ref={setPin}
      data-react-grab-ignore-events
      data-react-grab-collapsed-dot
      aria-expanded={props.expanded}
      class="fixed animate-in fade-in-0 zoom-in-95 ease-out"
      style={{
        ...floating.style(),
        "z-index": "var(--z-overlay)",
        "pointer-events": "auto",
      }}
      onClick={(event) => {
        event.stopImmediatePropagation();
        props.onExpand();
      }}
      onPointerDown={(event) => event.stopImmediatePropagation()}
    >
      <StatusDot color={props.statusColor} />
      <Show when={props.ticketKey}>{(key) => <PinKey>{key()}</PinKey>}</Show>
      <Show when={previewText()}>
        {(text) => (
          <PinText data-react-grab-collapsed-dot-preview>{text()}</PinText>
        )}
      </Show>
    </Pin>
  );
};
