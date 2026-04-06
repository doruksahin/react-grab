import { createEffect, onCleanup, onMount, on } from "solid-js";
import type { Component } from "solid-js";
import type {
  OverlayBounds,
  SelectionLabelInstance,
  AgentSession,
} from "../types.js";
import { lerp } from "../utils/lerp.js";
import {
  SELECTION_LERP_FACTOR,
  FEEDBACK_DURATION_MS,
  DRAG_LERP_FACTOR,
  LERP_CONVERGENCE_THRESHOLD_PX,
  FADE_OUT_BUFFER_MS,
  MIN_DEVICE_PIXEL_RATIO,
  Z_INDEX_OVERLAY_CANVAS,
  OVERLAY_BORDER_COLOR_DRAG,
  OVERLAY_FILL_COLOR_DRAG,
  OPACITY_CONVERGENCE_THRESHOLD,
  OVERLAY_BORDER_COLOR_DEFAULT,
  OVERLAY_FILL_COLOR_DEFAULT,
  OVERLAY_BORDER_COLOR_INSPECT,
  OVERLAY_FILL_COLOR_INSPECT,
  ACTIVE_GROUP_BORDER_COLOR,
  ACTIVE_GROUP_FILL_COLOR,
  ACTIVE_GROUP_STROKE_WIDTH,
  ACTIVE_GROUP_SHADOW_PASSES,
  STATUS_OVERLAY_BORDER_ALPHA,
  STATUS_OVERLAY_FILL_ALPHA,
  SHAKE_DURATION_MS,
  SHAKE_AMPLITUDE_PX,
  SHAKE_PERIOD_MS,
} from "../constants.js";
import {
  nativeCancelAnimationFrame,
  nativeRequestAnimationFrame,
} from "../utils/native-raf.js";
import { supportsDisplayP3 } from "../utils/supports-display-p3.js";
import { statusOverlayColor, activeGroupOverlayColor } from "../utils/overlay-color.js";

/**
 * Returns the horizontal shake offset (in px) for a decaying sine oscillation.
 * Amplitude decays linearly to zero over SHAKE_DURATION_MS.
 * Returns 0 once the animation has completed.
 */
const computeShakeOffset = (shakeStartTime: number, now: number): number => {
  const elapsed = now - shakeStartTime;
  if (elapsed >= SHAKE_DURATION_MS) return 0;
  const decay = 1 - elapsed / SHAKE_DURATION_MS;
  const oscillation = Math.sin((elapsed / SHAKE_PERIOD_MS) * Math.PI * 2);
  return oscillation * SHAKE_AMPLITUDE_PX * decay;
};

const isShakeActive = (shakeStartTime: number | undefined, now: number): boolean =>
  shakeStartTime !== undefined && now - shakeStartTime < SHAKE_DURATION_MS;

const DEFAULT_LAYER_STYLE = {
  borderColor: OVERLAY_BORDER_COLOR_DEFAULT,
  fillColor: OVERLAY_FILL_COLOR_DEFAULT,
  lerpFactor: SELECTION_LERP_FACTOR,
} as const;

const INSPECT_LAYER_STYLE = {
  borderColor: OVERLAY_BORDER_COLOR_INSPECT,
  fillColor: OVERLAY_FILL_COLOR_INSPECT,
  lerpFactor: SELECTION_LERP_FACTOR,
} as const;

const LAYER_STYLES = {
  drag: {
    borderColor: OVERLAY_BORDER_COLOR_DRAG,
    fillColor: OVERLAY_FILL_COLOR_DRAG,
    lerpFactor: DRAG_LERP_FACTOR,
  },
  selection: DEFAULT_LAYER_STYLE,
  grabbed: DEFAULT_LAYER_STYLE,
  processing: DEFAULT_LAYER_STYLE,
  inspect: INSPECT_LAYER_STYLE,
} as const;

type LayerName = "drag" | "selection" | "grabbed" | "processing" | "inspect";

interface OffscreenLayer {
  canvas: OffscreenCanvas | null;
  context: OffscreenCanvasRenderingContext2D | null;
}

interface AnimatedBounds {
  id: string;
  current: { x: number; y: number; width: number; height: number };
  target: { x: number; y: number; width: number; height: number };
  borderRadius: number;
  opacity: number;
  targetOpacity: number;
  createdAt?: number;
  isInitialized: boolean;
  borderColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  shadowPasses?: ReadonlyArray<{ blur: number; alpha: number }>;
  shadowBaseColor?: string;
  shakeStartTime?: number;
}

export interface OverlayCanvasProps {
  selectionVisible?: boolean;
  selectionBounds?: OverlayBounds;
  selectionBoundsMultiple?: OverlayBounds[];
  selectionIsFading?: boolean;
  selectionShouldSnap?: boolean;

  inspectVisible?: boolean;
  inspectBounds?: OverlayBounds[];

  dragVisible?: boolean;
  dragBounds?: OverlayBounds;

  grabbedBoxes?: Array<{
    id: string;
    bounds: OverlayBounds;
    createdAt: number;
  }>;

  agentSessions?: Map<string, AgentSession>;

  labelInstances?: SelectionLabelInstance[];

  activeGroupId?: string | null;
}

export const OverlayCanvas: Component<OverlayCanvasProps> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined;
  let mainContext: CanvasRenderingContext2D | null = null;
  let canvasWidth = 0;
  let canvasHeight = 0;
  let devicePixelRatio = 1;
  let animationFrameId: number | null = null;

  const layers: Record<LayerName, OffscreenLayer> = {
    drag: { canvas: null, context: null },
    selection: { canvas: null, context: null },
    grabbed: { canvas: null, context: null },
    processing: { canvas: null, context: null },
    inspect: { canvas: null, context: null },
  };

  let selectionAnimations: AnimatedBounds[] = [];
  let dragAnimation: AnimatedBounds | null = null;
  let grabbedAnimations: AnimatedBounds[] = [];
  let processingAnimations: AnimatedBounds[] = [];
  let inspectAnimations: AnimatedBounds[] = [];
  // Set once when activeGroupId changes — shared across all label animations for that frame.
  // Never re-assigned on labelInstances re-renders, so the shake does not restart.
  let shakeEpoch: number | null = null;

  const canvasColorSpace: PredefinedColorSpace = supportsDisplayP3()
    ? "display-p3"
    : "srgb";

  const createOffscreenLayer = (
    layerWidth: number,
    layerHeight: number,
    scaleFactor: number,
  ): OffscreenLayer => {
    const canvas = new OffscreenCanvas(
      layerWidth * scaleFactor,
      layerHeight * scaleFactor,
    );
    const context = canvas.getContext("2d", { colorSpace: canvasColorSpace });
    if (context) {
      context.scale(scaleFactor, scaleFactor);
    }
    return { canvas, context };
  };

  const initializeCanvas = () => {
    if (!canvasRef) return;

    devicePixelRatio = Math.max(
      window.devicePixelRatio || 1,
      MIN_DEVICE_PIXEL_RATIO,
    );
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;

    canvasRef.width = canvasWidth * devicePixelRatio;
    canvasRef.height = canvasHeight * devicePixelRatio;
    canvasRef.style.width = `${canvasWidth}px`;
    canvasRef.style.height = `${canvasHeight}px`;

    mainContext = canvasRef.getContext("2d", { colorSpace: canvasColorSpace });
    if (mainContext) {
      mainContext.scale(devicePixelRatio, devicePixelRatio);
    }

    for (const layerName of Object.keys(layers) as LayerName[]) {
      layers[layerName] = createOffscreenLayer(
        canvasWidth,
        canvasHeight,
        devicePixelRatio,
      );
    }
  };

  const parseBorderRadiusValue = (borderRadius: string): number => {
    if (!borderRadius) return 0;
    const match = borderRadius.match(/^(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  };

  const createAnimatedBounds = (
    id: string,
    bounds: OverlayBounds,
    options?: { createdAt?: number; opacity?: number; targetOpacity?: number },
  ): AnimatedBounds => ({
    id,
    current: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    },
    target: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    },
    borderRadius: parseBorderRadiusValue(bounds.borderRadius),
    opacity: options?.opacity ?? 1,
    targetOpacity: options?.targetOpacity ?? options?.opacity ?? 1,
    createdAt: options?.createdAt,
    isInitialized: true,
  });

  const updateAnimationTarget = (
    animation: AnimatedBounds,
    bounds: OverlayBounds,
    targetOpacity?: number,
  ) => {
    animation.target = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
    animation.borderRadius = parseBorderRadiusValue(bounds.borderRadius);
    if (targetOpacity !== undefined) {
      animation.targetOpacity = targetOpacity;
    }
  };

  const resolveBoundsArray = (
    instance: SelectionLabelInstance,
  ): OverlayBounds[] => instance.boundsMultiple ?? [instance.bounds];

  const drawRoundedRectangle = (
    context: OffscreenCanvasRenderingContext2D,
    rectX: number,
    rectY: number,
    rectWidth: number,
    rectHeight: number,
    cornerRadius: number,
    fillColor: string,
    strokeColor: string,
    opacity: number = 1,
    strokeWidth: number = 1,
  ) => {
    if (rectWidth <= 0 || rectHeight <= 0) return;

    const maxCornerRadius = Math.min(rectWidth / 2, rectHeight / 2);
    const clampedCornerRadius = Math.min(cornerRadius, maxCornerRadius);

    context.globalAlpha = opacity;
    context.beginPath();
    if (clampedCornerRadius > 0) {
      context.roundRect(
        rectX,
        rectY,
        rectWidth,
        rectHeight,
        clampedCornerRadius,
      );
    } else {
      context.rect(rectX, rectY, rectWidth, rectHeight);
    }
    context.fillStyle = fillColor;
    context.fill();
    context.strokeStyle = strokeColor;
    context.lineWidth = strokeWidth;
    context.stroke();
    context.globalAlpha = 1;
  };

  const renderDragLayer = () => {
    const layer = layers.drag;
    if (!layer.context) return;

    const context = layer.context;
    context.clearRect(0, 0, canvasWidth, canvasHeight);

    if (!props.dragVisible || !dragAnimation) return;

    const style = LAYER_STYLES.drag;
    drawRoundedRectangle(
      context,
      dragAnimation.current.x,
      dragAnimation.current.y,
      dragAnimation.current.width,
      dragAnimation.current.height,
      dragAnimation.borderRadius,
      style.fillColor,
      style.borderColor,
    );
  };

  const renderSelectionLayer = () => {
    const layer = layers.selection;
    if (!layer.context) return;

    const context = layer.context;
    context.clearRect(0, 0, canvasWidth, canvasHeight);

    if (!props.selectionVisible) return;

    const style = LAYER_STYLES.selection;

    for (const animation of selectionAnimations) {
      const effectiveOpacity = props.selectionIsFading ? 0 : animation.opacity;
      drawRoundedRectangle(
        context,
        animation.current.x,
        animation.current.y,
        animation.current.width,
        animation.current.height,
        animation.borderRadius,
        style.fillColor,
        style.borderColor,
        effectiveOpacity,
      );
    }
  };

  const renderBoundsLayer = (
    layerName: keyof typeof LAYER_STYLES,
    animations: AnimatedBounds[],
    now: number,
  ) => {
    const layer = layers[layerName];
    if (!layer.context) return;

    const context = layer.context;
    context.clearRect(0, 0, canvasWidth, canvasHeight);

    const style = LAYER_STYLES[layerName];

    for (const animation of animations) {
      const fillColor = animation.fillColor ?? style.fillColor;
      const borderColor = animation.borderColor ?? style.borderColor;
      const strokeWidth = animation.strokeWidth ?? 1;
      const drawX =
        animation.current.x +
        (animation.shakeStartTime !== undefined
          ? computeShakeOffset(animation.shakeStartTime, now)
          : 0);

      if (animation.shadowPasses && animation.shadowBaseColor) {
        for (const pass of animation.shadowPasses) {
          context.shadowColor = activeGroupOverlayColor(pass.alpha);
          context.shadowBlur = pass.blur;
          drawRoundedRectangle(
            context,
            drawX,
            animation.current.y,
            animation.current.width,
            animation.current.height,
            animation.borderRadius,
            fillColor,
            borderColor,
            animation.opacity,
            strokeWidth,
          );
        }
        context.shadowColor = "transparent";
        context.shadowBlur = 0;
      } else {
        drawRoundedRectangle(
          context,
          drawX,
          animation.current.y,
          animation.current.width,
          animation.current.height,
          animation.borderRadius,
          fillColor,
          borderColor,
          animation.opacity,
          strokeWidth,
        );
      }
    }
  };

  const compositeAllLayers = (now: number) => {
    if (!mainContext || !canvasRef) return;

    mainContext.setTransform(1, 0, 0, 1, 0, 0);
    mainContext.clearRect(0, 0, canvasRef.width, canvasRef.height);
    mainContext.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    renderDragLayer();
    renderSelectionLayer();
    renderBoundsLayer("grabbed", grabbedAnimations, now);
    renderBoundsLayer("processing", processingAnimations, now);
    renderBoundsLayer("inspect", inspectAnimations, now);

    const layerRenderOrder: LayerName[] = [
      "inspect",
      "drag",
      "selection",
      "grabbed",
      "processing",
    ];
    for (const layerName of layerRenderOrder) {
      const layer = layers[layerName];
      if (layer.canvas) {
        mainContext.drawImage(layer.canvas, 0, 0, canvasWidth, canvasHeight);
      }
    }
  };

  const interpolateBounds = (
    animation: AnimatedBounds,
    lerpFactor: number,
    options?: { interpolateOpacity?: boolean },
  ): boolean => {
    const lerpedX = lerp(animation.current.x, animation.target.x, lerpFactor);
    const lerpedY = lerp(animation.current.y, animation.target.y, lerpFactor);
    const lerpedWidth = lerp(
      animation.current.width,
      animation.target.width,
      lerpFactor,
    );
    const lerpedHeight = lerp(
      animation.current.height,
      animation.target.height,
      lerpFactor,
    );

    const hasBoundsConverged =
      Math.abs(lerpedX - animation.target.x) < LERP_CONVERGENCE_THRESHOLD_PX &&
      Math.abs(lerpedY - animation.target.y) < LERP_CONVERGENCE_THRESHOLD_PX &&
      Math.abs(lerpedWidth - animation.target.width) <
        LERP_CONVERGENCE_THRESHOLD_PX &&
      Math.abs(lerpedHeight - animation.target.height) <
        LERP_CONVERGENCE_THRESHOLD_PX;

    animation.current.x = hasBoundsConverged ? animation.target.x : lerpedX;
    animation.current.y = hasBoundsConverged ? animation.target.y : lerpedY;
    animation.current.width = hasBoundsConverged
      ? animation.target.width
      : lerpedWidth;
    animation.current.height = hasBoundsConverged
      ? animation.target.height
      : lerpedHeight;

    let hasOpacityConverged = true;
    if (options?.interpolateOpacity) {
      const lerpedOpacity = lerp(
        animation.opacity,
        animation.targetOpacity,
        lerpFactor,
      );
      const opacityThreshold = OPACITY_CONVERGENCE_THRESHOLD;
      hasOpacityConverged =
        Math.abs(lerpedOpacity - animation.targetOpacity) < opacityThreshold;
      animation.opacity = hasOpacityConverged
        ? animation.targetOpacity
        : lerpedOpacity;
    }

    return !hasBoundsConverged || !hasOpacityConverged;
  };

  const runAnimationFrame = () => {
    const now = Date.now();
    let shouldContinueAnimating = false;

    if (dragAnimation?.isInitialized) {
      if (interpolateBounds(dragAnimation, LAYER_STYLES.drag.lerpFactor)) {
        shouldContinueAnimating = true;
      }
    }

    for (const animation of selectionAnimations) {
      if (animation.isInitialized) {
        if (interpolateBounds(animation, LAYER_STYLES.selection.lerpFactor)) {
          shouldContinueAnimating = true;
        }
      }
    }

    grabbedAnimations = grabbedAnimations.filter((animation) => {
      const isLabelAnimation = animation.id.startsWith("label-");

      if (animation.isInitialized) {
        const isStillAnimating = interpolateBounds(
          animation,
          LAYER_STYLES.grabbed.lerpFactor,
          { interpolateOpacity: isLabelAnimation },
        );
        if (isStillAnimating) {
          shouldContinueAnimating = true;
        }
      }

      if (isShakeActive(animation.shakeStartTime, now)) {
        shouldContinueAnimating = true;
      }

      if (animation.createdAt) {
        const elapsed = now - animation.createdAt;
        const fadeOutDeadline = FEEDBACK_DURATION_MS + FADE_OUT_BUFFER_MS;

        if (elapsed >= fadeOutDeadline) {
          return false;
        }

        if (elapsed > FEEDBACK_DURATION_MS) {
          const fadeProgress =
            (elapsed - FEEDBACK_DURATION_MS) / FADE_OUT_BUFFER_MS;
          animation.opacity = 1 - fadeProgress;
          shouldContinueAnimating = true;
        }

        return true;
      }

      if (isLabelAnimation) {
        const hasOpacityConverged =
          Math.abs(animation.opacity - animation.targetOpacity) <
          OPACITY_CONVERGENCE_THRESHOLD;
        if (hasOpacityConverged && animation.targetOpacity === 0) {
          return false;
        }
        return true;
      }

      return animation.opacity > 0;
    });

    for (const animation of processingAnimations) {
      if (animation.isInitialized) {
        if (interpolateBounds(animation, LAYER_STYLES.processing.lerpFactor)) {
          shouldContinueAnimating = true;
        }
      }
    }

    for (const animation of inspectAnimations) {
      if (animation.isInitialized) {
        if (interpolateBounds(animation, LAYER_STYLES.inspect.lerpFactor)) {
          shouldContinueAnimating = true;
        }
      }
    }

    compositeAllLayers(now);

    if (shouldContinueAnimating) {
      animationFrameId = nativeRequestAnimationFrame(runAnimationFrame);
    } else {
      animationFrameId = null;
    }
  };

  const scheduleAnimationFrame = () => {
    if (animationFrameId !== null) return;
    animationFrameId = nativeRequestAnimationFrame(runAnimationFrame);
  };

  const handleWindowResize = () => {
    initializeCanvas();
    scheduleAnimationFrame();
  };

  createEffect(
    on(
      () =>
        [
          props.selectionVisible,
          props.selectionBounds,
          props.selectionBoundsMultiple,
          props.selectionIsFading,
          props.selectionShouldSnap,
        ] as const,
      ([isVisible, singleBounds, multipleBounds, , shouldSnap]) => {
        if (
          !isVisible ||
          (!singleBounds && (!multipleBounds || multipleBounds.length === 0))
        ) {
          selectionAnimations = [];
          scheduleAnimationFrame();
          return;
        }

        let boundsToRender: readonly OverlayBounds[];
        if (multipleBounds && multipleBounds.length > 0) {
          boundsToRender = multipleBounds;
        } else if (singleBounds) {
          boundsToRender = [singleBounds];
        } else {
          boundsToRender = [];
        }

        selectionAnimations = boundsToRender.map((bounds, index) => {
          const animationId = `selection-${index}`;
          const existingAnimation = selectionAnimations.find(
            (animation) => animation.id === animationId,
          );

          if (existingAnimation) {
            updateAnimationTarget(existingAnimation, bounds);
            if (shouldSnap) {
              existingAnimation.current = { ...existingAnimation.target };
            }
            return existingAnimation;
          }

          return createAnimatedBounds(animationId, bounds);
        });

        scheduleAnimationFrame();
      },
    ),
  );

  createEffect(
    on(
      () => [props.dragVisible, props.dragBounds] as const,
      ([isVisible, bounds]) => {
        if (!isVisible || !bounds) {
          dragAnimation = null;
          scheduleAnimationFrame();
          return;
        }

        if (dragAnimation) {
          updateAnimationTarget(dragAnimation, bounds);
        } else {
          dragAnimation = createAnimatedBounds("drag", bounds);
        }

        scheduleAnimationFrame();
      },
    ),
  );

  createEffect(
    on(
      () => [props.grabbedBoxes, props.labelInstances, props.activeGroupId] as const,
      ([grabbedBoxes, labelInstances]) => { // activeGroupId accessed via props.activeGroupId
        const boxesToProcess = grabbedBoxes ?? [];
        const activeBoxIds = new Set(boxesToProcess.map((box) => box.id));
        const existingAnimationIds = new Set(
          grabbedAnimations.map((animation) => animation.id),
        );

        for (const box of boxesToProcess) {
          if (!existingAnimationIds.has(box.id)) {
            grabbedAnimations.push(
              createAnimatedBounds(box.id, box.bounds, {
                createdAt: box.createdAt,
              }),
            );
          }
        }

        for (const animation of grabbedAnimations) {
          const matchingBox = boxesToProcess.find(
            (box) => box.id === animation.id,
          );
          if (matchingBox) {
            updateAnimationTarget(animation, matchingBox.bounds);
          }
        }

        const instancesToProcess = labelInstances ?? [];
        const currentActiveGroupId = props.activeGroupId;

        for (const instance of instancesToProcess) {
          const boundsToRender = resolveBoundsArray(instance);
          const targetOpacity = instance.status === "fading" ? 0 : 1;
          const isActiveGroup =
            currentActiveGroupId != null &&
            instance.groupId === currentActiveGroupId;
          const instanceBorderColor = isActiveGroup
            ? ACTIVE_GROUP_BORDER_COLOR
            : instance.groupStatus
              ? statusOverlayColor(instance.groupStatus, STATUS_OVERLAY_BORDER_ALPHA)
              : OVERLAY_BORDER_COLOR_DEFAULT;
          const instanceFillColor = isActiveGroup
            ? ACTIVE_GROUP_FILL_COLOR
            : instance.groupStatus
              ? statusOverlayColor(instance.groupStatus, STATUS_OVERLAY_FILL_ALPHA)
              : OVERLAY_FILL_COLOR_DEFAULT;
          const instanceShadowPasses = isActiveGroup
            ? ACTIVE_GROUP_SHADOW_PASSES
            : undefined;

          for (let index = 0; index < boundsToRender.length; index++) {
            const bounds = boundsToRender[index];
            const animationId = `label-${instance.id}-${index}`;
            const existingAnimation = grabbedAnimations.find(
              (animation) => animation.id === animationId,
            );

            if (existingAnimation) {
              updateAnimationTarget(existingAnimation, bounds, targetOpacity);
              existingAnimation.borderColor = instanceBorderColor;
              existingAnimation.fillColor = instanceFillColor;
              existingAnimation.strokeWidth = isActiveGroup ? ACTIVE_GROUP_STROKE_WIDTH : undefined;
              existingAnimation.shadowPasses = instanceShadowPasses;
              existingAnimation.shadowBaseColor = isActiveGroup ? ACTIVE_GROUP_BORDER_COLOR : undefined;
              existingAnimation.shakeStartTime =
                isActiveGroup && shakeEpoch !== null ? shakeEpoch : undefined;
            } else {
              const anim = createAnimatedBounds(animationId, bounds, {
                opacity: 1,
                targetOpacity,
              });
              anim.borderColor = instanceBorderColor;
              anim.fillColor = instanceFillColor;
              anim.strokeWidth = isActiveGroup ? ACTIVE_GROUP_STROKE_WIDTH : undefined;
              anim.shadowPasses = instanceShadowPasses;
              anim.shadowBaseColor = isActiveGroup ? ACTIVE_GROUP_BORDER_COLOR : undefined;
              anim.shakeStartTime =
                isActiveGroup && shakeEpoch !== null ? shakeEpoch : undefined;
              grabbedAnimations.push(anim);
            }
          }
        }

        const activeLabelIds = new Set<string>();
        for (const instance of instancesToProcess) {
          const boundsToRender = resolveBoundsArray(instance);
          for (let index = 0; index < boundsToRender.length; index++) {
            activeLabelIds.add(`label-${instance.id}-${index}`);
          }
        }

        grabbedAnimations = grabbedAnimations.filter((animation) => {
          if (animation.id.startsWith("label-")) {
            return activeLabelIds.has(animation.id);
          }
          return activeBoxIds.has(animation.id);
        });

        scheduleAnimationFrame();
      },
    ),
  );

  createEffect(
    on(
      () => props.agentSessions,
      (agentSessions) => {
        if (!agentSessions || agentSessions.size === 0) {
          processingAnimations = [];
          scheduleAnimationFrame();
          return;
        }

        const updatedAnimations: AnimatedBounds[] = [];

        for (const [sessionId, session] of agentSessions) {
          for (let index = 0; index < session.selectionBounds.length; index++) {
            const bounds = session.selectionBounds[index];
            const animationId = `processing-${sessionId}-${index}`;
            const existingAnimation = processingAnimations.find(
              (animation) => animation.id === animationId,
            );

            if (existingAnimation) {
              updateAnimationTarget(existingAnimation, bounds);
              updatedAnimations.push(existingAnimation);
            } else {
              updatedAnimations.push(createAnimatedBounds(animationId, bounds));
            }
          }
        }

        processingAnimations = updatedAnimations;
        scheduleAnimationFrame();
      },
    ),
  );

  createEffect(
    on(
      () => [props.inspectVisible, props.inspectBounds] as const,
      ([isVisible, bounds]) => {
        if (!isVisible || !bounds || bounds.length === 0) {
          inspectAnimations = [];
          scheduleAnimationFrame();
          return;
        }

        inspectAnimations = bounds.map((ancestorBounds, index) => {
          const animationId = `inspect-${index}`;
          const existingAnimation = inspectAnimations.find(
            (animation) => animation.id === animationId,
          );

          if (existingAnimation) {
            updateAnimationTarget(existingAnimation, ancestorBounds);
            return existingAnimation;
          }

          return createAnimatedBounds(animationId, ancestorBounds);
        });

        scheduleAnimationFrame();
      },
    ),
  );

  // Dedicated effect: set shakeEpoch only when activeGroupId changes.
  // Decoupled from labelInstances so the epoch is never re-assigned on re-renders,
  // which would restart the shake after it completes.
  createEffect(
    on(
      () => props.activeGroupId,
      (activeGroupId) => {
        shakeEpoch = activeGroupId != null ? Date.now() : null;
        scheduleAnimationFrame();
      },
    ),
  );

  onMount(() => {
    initializeCanvas();
    scheduleAnimationFrame();

    window.addEventListener("resize", handleWindowResize);

    let currentDprMediaQuery: MediaQueryList | null = null;

    const handleDevicePixelRatioChange = () => {
      const newDevicePixelRatio = Math.max(
        window.devicePixelRatio || 1,
        MIN_DEVICE_PIXEL_RATIO,
      );
      if (newDevicePixelRatio !== devicePixelRatio) {
        handleWindowResize();
        setupDprMediaQuery();
      }
    };

    const setupDprMediaQuery = () => {
      if (currentDprMediaQuery) {
        currentDprMediaQuery.removeEventListener(
          "change",
          handleDevicePixelRatioChange,
        );
      }
      currentDprMediaQuery = window.matchMedia(
        `(resolution: ${window.devicePixelRatio}dppx)`,
      );
      currentDprMediaQuery.addEventListener(
        "change",
        handleDevicePixelRatioChange,
      );
    };

    setupDprMediaQuery();

    onCleanup(() => {
      window.removeEventListener("resize", handleWindowResize);
      if (currentDprMediaQuery) {
        currentDprMediaQuery.removeEventListener(
          "change",
          handleDevicePixelRatioChange,
        );
      }
      if (animationFrameId !== null) {
        nativeCancelAnimationFrame(animationFrameId);
      }
    });
  });

  return (
    <canvas
      ref={canvasRef}
      data-react-grab-overlay-canvas
      style={{
        position: "fixed",
        top: "0",
        left: "0",
        "pointer-events": "none",
        "z-index": String(Z_INDEX_OVERLAY_CANVAS),
      }}
    />
  );
};
