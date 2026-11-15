import type { AnchorRect } from "./resolve-label-anchor.js";

export interface PinAnchor {
  id: string;
  /** The element the pin belongs to; the pin sits under its left edge. */
  rect: AnchorRect;
}

export interface PinSize {
  width: number;
  height: number;
  /** Space between the element and its pin, and between stacked pins. */
  gap: number;
}

interface PlacedPin {
  x: number;
  top: number;
  bottom: number;
}

const overlapsHorizontally = (
  left: number,
  other: PlacedPin,
  width: number,
): boolean => left < other.x + width && other.x < left + width;

/**
 * Keeps pins of nearby elements from landing on each other (ADR-0022: the
 * one placement rule no library covers). Each pin starts `gap` below its
 * element's left edge; a pin that would overlap a pin placed before it moves
 * down until it clears it, with `gap` between them. Pins are placed top to
 * bottom, then left to right, so the result does not depend on input order.
 *
 * Returns how far each pin moves down from its own start, by id.
 */
export const stackPins = (
  anchors: readonly PinAnchor[],
  size: PinSize,
): Map<string, number> => {
  const ordered = [...anchors].sort(
    (left, right) =>
      left.rect.y + left.rect.height - (right.rect.y + right.rect.height) ||
      left.rect.x - right.rect.x ||
      left.id.localeCompare(right.id),
  );
  const placed: PlacedPin[] = [];
  const offsets = new Map<string, number>();

  for (const anchor of ordered) {
    const x = anchor.rect.x;
    const start = anchor.rect.y + anchor.rect.height + size.gap;
    let top = start;
    let moved = true;
    while (moved) {
      moved = false;
      for (const other of placed) {
        if (!overlapsHorizontally(x, other, size.width)) continue;
        if (top < other.bottom + size.gap && other.top < top + size.height) {
          top = other.bottom + size.gap;
          moved = true;
        }
      }
    }
    placed.push({ x, top, bottom: top + size.height });
    offsets.set(anchor.id, top - start);
  }

  return offsets;
};
