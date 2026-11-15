import type { OverlayBounds } from "../../../types.js";

export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ResolveLabelAnchorInput {
  bounds: OverlayBounds | undefined;
  /** Pointer x over the element; the label centres there. */
  pointerX: number | undefined;
  /** The visible area (the visual viewport). */
  viewport: AnchorRect;
  /** The label has a measured size. */
  hasMeasurements: boolean;
}

export type LabelAnchor =
  | { kind: "track"; rect: AnchorRect }
  | { kind: "keep" }
  | { kind: "hide" };

/**
 * Where a selection label anchors (product rules, no coordinates):
 * - without a measured label or element bounds, it keeps its last position;
 * - while its element is out of view, it is hidden;
 * - otherwise it anchors to the element at the pointer's x (the element's
 *   centre when there is no pointer), as a zero-width rect over its height.
 */
export const resolveLabelAnchor = ({
  bounds,
  pointerX,
  viewport,
  hasMeasurements,
}: ResolveLabelAnchorInput): LabelAnchor => {
  const hasValidBounds = bounds && bounds.width > 0 && bounds.height > 0;
  if (!hasMeasurements || !hasValidBounds) return { kind: "keep" };

  const isInView =
    bounds.x + bounds.width > viewport.x &&
    bounds.x < viewport.x + viewport.width &&
    bounds.y + bounds.height > viewport.y &&
    bounds.y < viewport.y + viewport.height;
  if (!isInView) return { kind: "hide" };

  return {
    kind: "track",
    rect: {
      x: pointerX ?? bounds.x + bounds.width / 2,
      y: bounds.y,
      width: 0,
      height: bounds.height,
    },
  };
};
