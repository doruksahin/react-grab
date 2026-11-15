import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";
import type { Placement } from "@floating-ui/dom";
import type { DropdownAnchor } from "../types.js";
import {
  DROPDOWN_ANCHOR_GAP_PX,
  DROPDOWN_ANIMATION_DURATION_MS,
  DROPDOWN_OFFSCREEN_POSITION,
  DROPDOWN_VIEWPORT_PADDING_PX,
} from "../constants.js";
import { createFloating, virtualReference } from "./floating.js";
import {
  nativeCancelAnimationFrame,
  nativeRequestAnimationFrame,
} from "./native-raf.js";

interface AnchoredDropdownOptions {
  /** Cap the dropdown's height to the space left in the viewport. */
  fitHeight?: boolean;
  /** Cap the dropdown's width to this and to the space left. */
  maxWidthPx?: number;
}

interface AnchoredDropdownResult {
  shouldMount: Accessor<boolean>;
  isAnimatedIn: Accessor<boolean>;
  lastAnchorEdge: Accessor<DropdownAnchor["edge"]>;
  displayPosition: Accessor<{ left: number; top: number }>;
  clearAnimationHandles: () => void;
}

// The dropdown opens away from the toolbar edge it is anchored to.
const PLACEMENT_BY_EDGE: Record<DropdownAnchor["edge"], Placement> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

export const createAnchoredDropdown = (
  containerRef: () => HTMLDivElement | undefined,
  anchorAccessor: Accessor<DropdownAnchor | null>,
  options: AnchoredDropdownOptions = {},
): AnchoredDropdownResult => {
  const [shouldMount, setShouldMount] = createSignal(false);
  const [isAnimatedIn, setIsAnimatedIn] = createSignal(false);
  const [container, setContainer] = createSignal<HTMLDivElement>();
  const [lastAnchorEdge, setLastAnchorEdge] =
    createSignal<DropdownAnchor["edge"]>("bottom");

  let exitAnimationTimeout: ReturnType<typeof setTimeout> | undefined;
  let enterAnimationFrameId: number | undefined;

  const clearAnimationHandles = () => {
    clearTimeout(exitAnimationTimeout);
    if (enterAnimationFrameId !== undefined) {
      nativeCancelAnimationFrame(enterAnimationFrameId);
      enterAnimationFrameId = undefined;
    }
  };

  createEffect(() => {
    const anchor = anchorAccessor();
    if (anchor) {
      setLastAnchorEdge(anchor.edge);
      clearTimeout(exitAnimationTimeout);
      setShouldMount(true);
      if (enterAnimationFrameId !== undefined)
        nativeCancelAnimationFrame(enterAnimationFrameId);
      // HACK: rAF lets the mounted container take its position before transitioning in
      enterAnimationFrameId = nativeRequestAnimationFrame(() => {
        setContainer(containerRef());
        void containerRef()?.offsetHeight;
        setIsAnimatedIn(true);
      });
    } else {
      if (enterAnimationFrameId !== undefined)
        nativeCancelAnimationFrame(enterAnimationFrameId);
      setIsAnimatedIn(false);
      exitAnimationTimeout = setTimeout(() => {
        setShouldMount(false);
        setContainer(undefined);
      }, DROPDOWN_ANIMATION_DURATION_MS);
    }
    onCleanup(clearAnimationHandles);
  });

  // One reference for the whole time the dropdown is open; it reads the
  // latest anchor point, which the toolbar updates every frame.
  const anchorReference = virtualReference(() => {
    const anchor = anchorAccessor();
    return { x: anchor?.x ?? 0, y: anchor?.y ?? 0, width: 0, height: 0 };
  });
  const isOpen = createMemo(() => anchorAccessor() !== null);

  const position = createFloating({
    reference: () => (isOpen() ? anchorReference : null),
    floating: container,
    options: () => ({
      placement: PLACEMENT_BY_EDGE[lastAnchorEdge()],
      offsetPx: DROPDOWN_ANCHOR_GAP_PX,
      paddingPx: DROPDOWN_VIEWPORT_PADDING_PX,
      fitHeight: options.fitHeight,
      maxWidthPx: options.maxWidthPx,
      followEveryFrame: true,
    }),
  });

  const displayPosition = () => {
    const current = position();
    return current
      ? { left: current.x, top: current.y }
      : DROPDOWN_OFFSCREEN_POSITION;
  };

  return {
    shouldMount,
    isAnimatedIn,
    lastAnchorEdge,
    displayPosition,
    clearAnimationHandles,
  };
};
