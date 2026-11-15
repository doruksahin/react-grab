import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  size,
  type Middleware,
  type Placement,
  type Rect,
  type ReferenceElement,
  type VirtualElement,
} from "@floating-ui/dom";
import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";

/**
 * Overlay placement on Floating UI (ADR-0005: `strategy: "fixed"` inside the
 * Shadow DOM; ADR-0022: no coordinate maths in components).
 */
export interface FloatingOptions {
  placement: Placement;
  /** Gap between the reference and the floating element, in px. */
  offsetPx?: number;
  /** Minimum distance from the viewport (or `boundary`) edges, in px. */
  paddingPx?: number;
  /** Placements to try when the preferred one does not fit. */
  fallbackPlacements?: Placement[];
  /** Area to stay inside instead of the layout viewport (e.g. the visual viewport). */
  boundary?: Rect;
  /** Cap the floating element's height to the space available. */
  fitHeight?: boolean;
  /** Cap the floating element's width to this and to the space available. */
  maxWidthPx?: number;
  /** Re-measure every animation frame (for references that move on their own). */
  followEveryFrame?: boolean;
  /**
   * Report where the reference's horizontal centre falls on the floating
   * element (for an arrow), kept this far from the floating element's edges.
   */
  anchorPaddingPx?: number;
}

export interface FloatingPosition {
  x: number;
  y: number;
  placement: Placement;
  /** Reference centre relative to the floating element's left edge, in px. */
  anchorOffsetX: number;
}

/** A Floating UI reference for a rect that is not a DOM element. */
export const virtualReference = (getRect: () => Rect): VirtualElement => ({
  getBoundingClientRect: () => {
    const rect = getRect();
    return {
      ...rect,
      top: rect.y,
      left: rect.x,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
    };
  },
});

const buildMiddleware = (options: FloatingOptions): Middleware[] => {
  const overflow = {
    padding: options.paddingPx ?? 0,
    ...(options.boundary ? { rootBoundary: options.boundary } : {}),
  };
  const middleware: Middleware[] = [
    offset(options.offsetPx ?? 0),
    flip({
      ...overflow,
      fallbackPlacements: options.fallbackPlacements,
      fallbackStrategy: "bestFit",
    }),
    shift({ ...overflow, crossAxis: true }),
  ];
  const { fitHeight, maxWidthPx } = options;
  if (fitHeight || maxWidthPx !== undefined) {
    middleware.push(
      size({
        ...overflow,
        apply: ({ availableHeight, availableWidth, elements }) => {
          if (fitHeight) {
            elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`;
          }
          if (maxWidthPx !== undefined) {
            elements.floating.style.maxWidth = `${Math.max(0, Math.min(maxWidthPx, availableWidth))}px`;
          }
        },
      }),
    );
  }
  return middleware;
};

/**
 * Positions `floating` against `reference` now and whenever either moves or
 * resizes. Returns the cleanup function.
 */
export const trackFloating = (
  reference: ReferenceElement,
  floating: HTMLElement,
  options: FloatingOptions,
  onPosition: (position: FloatingPosition) => void,
): (() => void) => {
  let isTracking = true;
  const update = () => {
    void computePosition(reference, floating, {
      strategy: "fixed",
      placement: options.placement,
      middleware: buildMiddleware(options),
    }).then(({ x, y, placement }) => {
      if (!isTracking) return;
      const referenceRect = reference.getBoundingClientRect();
      const referenceCentre = referenceRect.x + referenceRect.width / 2;
      const floatingWidth = floating.offsetWidth;
      const padding = Math.min(options.anchorPaddingPx ?? 0, floatingWidth / 2);
      const anchorOffsetX = Math.max(
        padding,
        Math.min(floatingWidth - padding, referenceCentre - x),
      );
      onPosition({ x, y, placement, anchorOffsetX });
    });
  };
  const stopAutoUpdate = autoUpdate(reference, floating, update, {
    animationFrame: options.followEveryFrame ?? false,
  });
  return () => {
    isTracking = false;
    stopAutoUpdate();
  };
};

interface CreateFloatingArgs {
  /** The anchor; `null` stops tracking and keeps the last position. */
  reference: Accessor<ReferenceElement | null>;
  floating: Accessor<HTMLElement | undefined>;
  options: Accessor<FloatingOptions>;
}

/** Reactive `trackFloating`: the position follows the reference and options. */
export const createFloating = (
  args: CreateFloatingArgs,
): Accessor<FloatingPosition | null> => {
  const [position, setPosition] = createSignal<FloatingPosition | null>(null);

  createEffect(() => {
    const reference = args.reference();
    const floating = args.floating();
    if (!reference || !floating) return;
    onCleanup(trackFloating(reference, floating, args.options(), setPosition));
  });

  return position;
};
