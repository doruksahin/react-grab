import {
  arrow,
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
  type Side,
  type VirtualElement,
} from "@floating-ui/dom";
import {
  type Accessor,
  createEffect,
  createSignal,
  onCleanup,
  untrack,
} from "solid-js";
import { FLOATING_GAP_PX, FLOATING_VIEWPORT_PADDING_PX } from "../constants.js";

/**
 * Overlay placement on Floating UI (ADR-0005: `strategy: "fixed"` inside the
 * Shadow DOM; ADR-0022: no coordinate maths in components).
 */
export interface FloatingOptions {
  placement: Placement;
  /** Gap between the reference and the floating element (default FLOATING_GAP_PX). */
  offsetPx?: number;
  /** Distance kept from the boundary edges (default FLOATING_VIEWPORT_PADDING_PX). */
  paddingPx?: number;
  /** Flip to the opposite side when the preferred one does not fit (default true). */
  flip?: boolean;
  /** Placements to try instead of the opposite side. */
  fallbackPlacements?: Placement[];
  /** Also shift along the placement axis, overlapping the reference if needed. */
  shiftCrossAxis?: boolean;
  /** Area to stay inside instead of the layout viewport (e.g. the visual viewport). */
  boundary?: Rect;
  /** Cap the floating element's height to the space available. */
  fitHeight?: boolean;
  /** Cap the floating element's width to this and to the space available. */
  maxWidthPx?: number;
  /** Re-measure every animation frame (for references that move on their own). */
  followEveryFrame?: boolean;
  /** An arrow inside the floating element, aligned to the reference. */
  arrowElement?: HTMLElement;
  /** Distance kept between the arrow and the floating element's corners. */
  arrowPaddingPx?: number;
}

export interface FloatingPosition {
  x: number;
  y: number;
  placement: Placement;
  side: Side;
  /** The arrow element's left offset inside the floating element. */
  arrowX: number | undefined;
}

export interface FloatingStyle {
  left: string;
  top: string;
  visibility: "visible" | "hidden";
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

const getSide = (placement: Placement): Side => {
  const [side] = placement.split("-");
  return side === "top" || side === "left" || side === "right"
    ? side
    : "bottom";
};

// Built once per tracked pair; every value is read from the current options
// when Floating UI computes, so option changes need no rebuild.
const buildMiddleware = (options: () => FloatingOptions): Middleware[] => {
  const overflow = () => {
    const current = options();
    return {
      padding: current.paddingPx ?? FLOATING_VIEWPORT_PADDING_PX,
      ...(current.boundary ? { rootBoundary: current.boundary } : {}),
    };
  };
  const middleware: Middleware[] = [
    offset(() => options().offsetPx ?? FLOATING_GAP_PX),
    flip(() => {
      const current = options();
      const isEnabled = current.flip !== false;
      return {
        ...overflow(),
        mainAxis: isEnabled,
        crossAxis: isEnabled,
        fallbackPlacements: current.fallbackPlacements,
        fallbackStrategy: "bestFit",
      };
    }),
    shift(() => ({
      ...overflow(),
      crossAxis: options().shiftCrossAxis ?? false,
    })),
    size(() => ({
      ...overflow(),
      apply: ({ availableHeight, availableWidth, elements }) => {
        const { fitHeight, maxWidthPx } = options();
        if (fitHeight) {
          elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`;
        }
        if (maxWidthPx !== undefined) {
          elements.floating.style.maxWidth = `${Math.max(0, Math.min(maxWidthPx, availableWidth))}px`;
        }
      },
    })),
  ];
  // Last, so it aligns the arrow to the final position.
  const initialArrow = options().arrowElement;
  if (initialArrow) {
    middleware.push(
      arrow(() => ({
        element: options().arrowElement ?? initialArrow,
        padding: options().arrowPaddingPx ?? 0,
      })),
    );
  }
  return middleware;
};

interface FloatingTracker {
  /** Recompute now (e.g. after the reference rect or the options changed). */
  update: () => void;
  stop: () => void;
}

/**
 * Positions `floating` against `reference` now and whenever either moves or
 * resizes (Floating UI autoUpdate).
 */
export const trackFloating = (
  reference: ReferenceElement,
  floating: HTMLElement,
  options: () => FloatingOptions,
  onPosition: (position: FloatingPosition) => void,
): FloatingTracker => {
  let isTracking = true;
  const middleware = buildMiddleware(options);
  const update = () => {
    void computePosition(reference, floating, {
      strategy: "fixed",
      placement: options().placement,
      middleware,
    }).then(({ x, y, placement, middlewareData }) => {
      if (!isTracking) return;
      onPosition({
        x,
        y,
        placement,
        side: getSide(placement),
        arrowX: middlewareData.arrow?.x,
      });
    });
  };
  const stopAutoUpdate = autoUpdate(reference, floating, update, {
    animationFrame: options().followEveryFrame ?? false,
  });
  return {
    update,
    stop: () => {
      isTracking = false;
      stopAutoUpdate();
    },
  };
};

interface CreateFloatingArgs {
  /** A stable reference; `null` stops tracking and keeps the last position. */
  reference: Accessor<ReferenceElement | null>;
  floating: Accessor<HTMLElement | undefined>;
  options: Accessor<FloatingOptions>;
  /** Read by the update effect: a change recomputes (e.g. the reference rect). */
  watch?: Accessor<unknown>;
}

interface FloatingResult {
  position: Accessor<FloatingPosition | null>;
  /** left / top, hidden until the first position is known. */
  style: Accessor<FloatingStyle>;
  /** Forget the last position (hidden again until the next one). */
  reset: () => void;
}

/** Reactive trackFloating. */
export const createFloating = (args: CreateFloatingArgs): FloatingResult => {
  const [position, setPosition] = createSignal<FloatingPosition | null>(null);
  let tracker: FloatingTracker | undefined;

  // Owns autoUpdate; re-runs only when the floating element or reference changes.
  createEffect(() => {
    const reference = args.reference();
    const floating = args.floating();
    if (!reference || !floating) return;
    const current = trackFloating(
      reference,
      floating,
      () => untrack(args.options),
      setPosition,
    );
    tracker = current;
    onCleanup(() => {
      current.stop();
      if (tracker === current) tracker = undefined;
    });
  });

  // Cheap: recompute when the options or the watched reference rect change.
  createEffect(() => {
    args.options();
    args.watch?.();
    tracker?.update();
  });

  const style = (): FloatingStyle => {
    const current = position();
    return {
      left: `${current?.x ?? 0}px`,
      top: `${current?.y ?? 0}px`,
      visibility: current ? "visible" : "hidden",
    };
  };

  return { position, style, reset: () => setPosition(null) };
};
