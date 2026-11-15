import { createEffect, createSignal, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";
import type { Placement } from "@floating-ui/dom";
import type { DropdownAnchor } from "../types.js";
import {
  DROPDOWN_ANCHOR_GAP_PX,
  DROPDOWN_ANIMATION_DURATION_MS,
} from "../constants.js";
import { createFloating, type FloatingStyle } from "./floating.js";
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
  /** left / top / visibility for the dropdown container. */
  floatingStyle: Accessor<FloatingStyle>;
  clearAnimationHandles: () => void;
}

// The dropdown opens away from the toolbar edge it is anchored to.
const PLACEMENT_BY_EDGE: Record<DropdownAnchor["edge"], Placement> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

/**
 * A toolbar dropdown: mount/enter/exit animation plus placement against the
 * toolbar element (Floating UI, followed every frame while the toolbar moves).
 */
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

  const floating = createFloating({
    reference: () => anchorAccessor()?.reference ?? null,
    floating: container,
    options: () => ({
      placement: PLACEMENT_BY_EDGE[lastAnchorEdge()],
      offsetPx: DROPDOWN_ANCHOR_GAP_PX,
      shiftCrossAxis: true,
      fitHeight: options.fitHeight,
      maxWidthPx: options.maxWidthPx,
      followEveryFrame: true,
    }),
  });

  return {
    shouldMount,
    isAnimatedIn,
    lastAnchorEdge,
    floatingStyle: floating.style,
    clearAnimationHandles,
  };
};
