import {
  Show,
  createSignal,
  createEffect,
  createMemo,
  on,
  onMount,
  onCleanup,
} from "solid-js";
import type { Component } from "solid-js";
import type { ArrowPosition } from "../../types.js";
import type { SelectionLabelRootProps } from "./types.js";
import type { SelectionLabelContextValue } from "./context.js";
import {
  VIEWPORT_MARGIN_PX,
  ARROW_LABEL_MARGIN_PX,
  LABEL_GAP_PX,
} from "../../constants.js";
import { getArrowSize } from "../../utils/get-arrow-size.js";
import { createFloating, virtualReference } from "../../utils/floating.js";
import type { Rect } from "@floating-ui/dom";
import { resolveLabelAnchor } from "../../features/selection-label/business/resolve-label-anchor.js";
import { isKeyboardEventTriggeredByInput } from "../../utils/is-keyboard-event-triggered-by-input.js";
import { cn } from "../../utils/cn.js";
import { RemoveSelectionButton } from "../remove-selection-button.jsx";
import { FLAGGED_BORDER_CLASS } from "../../features/sidebar/resolve-display-color.js";
import { Arrow } from "./arrow.js";
import { CompletionView } from "./completion-view.js";
import { SelectionLabelProvider } from "./context.js";
import { useDevMode } from "../../features/dev-mode/index.js";
import { SelectionLabelHeader } from "./parts/header.js";
import { SelectionLabelContent } from "./parts/content.js";
import { SelectionLabelContextInput } from "./parts/context-input.js";
import { DevInsightsSection } from "./parts/dev-insights-section.js";

export const SelectionLabelRoot: Component<SelectionLabelRootProps> = (
  props,
) => {
  const isDevMode = useDevMode();
  let containerRef: HTMLDivElement | undefined;
  let panelRef: HTMLDivElement | undefined;

  const [container, setContainer] = createSignal<HTMLDivElement>();
  const [measuredWidth, setMeasuredWidth] = createSignal(0);
  const [measuredHeight, setMeasuredHeight] = createSignal(0);
  const [panelWidth, setPanelWidth] = createSignal(0);
  const [viewportVersion, setViewportVersion] = createSignal(0);
  const [isInternalFading, setIsInternalFading] = createSignal(false);
  const [isShaking, setIsShaking] = createSignal(false);

  const canInteract = () =>
    props.status !== "copying" &&
    props.status !== "copied" &&
    props.status !== "fading" &&
    props.status !== "error";

  const isCompletedStatus = () =>
    props.status === "copied" || props.status === "fading";

  const shouldEnablePointerEvents = (): boolean => {
    if (props.isPromptMode) return true;
    if (isCompletedStatus() && (props.onDismiss || props.onShowContextMenu)) {
      return true;
    }
    if (props.status === "copying" && props.onAbort) return true;
    if (
      props.status === "error" &&
      (props.onAcknowledgeError || props.onRetry)
    ) {
      return true;
    }
    if (props.arrowNavigationState?.isVisible) return true;
    if (props.inspectNavigationState?.isVisible) return true;
    if (props.onRemoveItem && !props.jiraTicketId) return true;
    return false;
  };

  let resizeObserver: ResizeObserver | undefined;

  const handleViewportChange = () => {
    setViewportVersion((version) => version + 1);
  };

  const handleGlobalKeyDown = (event: KeyboardEvent) => {
    if (isKeyboardEventTriggeredByInput(event)) return;

    const isEnterToExpand =
      event.code === "Enter" && !props.isPromptMode && canInteract();
    const isCtrlCToAbort =
      event.code === "KeyC" &&
      event.ctrlKey &&
      props.status === "copying" &&
      props.onAbort;

    if (isEnterToExpand) {
      event.preventDefault();
      event.stopImmediatePropagation();
      props.onToggleExpand?.();
    } else if (isCtrlCToAbort) {
      event.preventDefault();
      event.stopImmediatePropagation();
      props.onAbort?.();
    }
  };

  onMount(() => {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.target.getBoundingClientRect();
        if (entry.target === containerRef) {
          setMeasuredWidth(rect.width);
          setMeasuredHeight(rect.height);
        } else if (entry.target === panelRef) {
          setPanelWidth(rect.width);
        }
      }
    });
    if (containerRef) {
      const rect = containerRef.getBoundingClientRect();
      setMeasuredWidth(rect.width);
      setMeasuredHeight(rect.height);
      resizeObserver.observe(containerRef);
    }
    if (panelRef) {
      setPanelWidth(panelRef.getBoundingClientRect().width);
      resizeObserver.observe(panelRef);
    }
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("scroll", handleViewportChange);
    window.addEventListener("keydown", handleGlobalKeyDown, { capture: true });
  });

  onCleanup(() => {
    resizeObserver?.disconnect();
    window.removeEventListener("scroll", handleViewportChange, true);
    window.removeEventListener("resize", handleViewportChange);
    window.visualViewport?.removeEventListener("resize", handleViewportChange);
    window.visualViewport?.removeEventListener("scroll", handleViewportChange);
    window.removeEventListener("keydown", handleGlobalKeyDown, {
      capture: true,
    });
  });

  const elementIdentity = () =>
    `${props.tagName ?? ""}:${props.componentName ?? ""}`;

  const visibleViewport = (): Rect => {
    viewportVersion();
    const visualViewport = window.visualViewport;
    return {
      x: visualViewport?.offsetLeft ?? 0,
      y: visualViewport?.offsetTop ?? 0,
      width: visualViewport?.width ?? window.innerWidth,
      height: visualViewport?.height ?? window.innerHeight,
    };
  };

  const anchor = createMemo(() =>
    resolveLabelAnchor({
      bounds: props.selectionBounds,
      pointerX: props.mouseX,
      viewport: visibleViewport(),
      hasMeasurements: measuredWidth() > 0 && measuredHeight() > 0,
    }),
  );

  // Whether the current element has been placed at least once; a new element
  // starts hidden until it gets a position of its own.
  const placedElement = createMemo(
    (previous: { identity: string; wasPlaced: boolean }) => {
      const identity = elementIdentity();
      const wasPlaced =
        (previous.identity === identity && previous.wasPlaced) ||
        anchor().kind === "track";
      return { identity, wasPlaced };
    },
    { identity: "", wasPlaced: false },
  );
  const hadValidBounds = () => placedElement().wasPlaced;

  const arrowHeight = () => (props.hideArrow ? 0 : getArrowSize(panelWidth()));

  const [arrowElement, setArrowElement] = createSignal<HTMLDivElement>();

  // The anchor rect the reference reads; the reference object itself stays
  // the same, so autoUpdate is not restarted when the element or pointer moves.
  const anchorRect = (): Rect | null => {
    const current = anchor();
    return current.kind === "track" ? current.rect : null;
  };
  const labelReference = virtualReference(
    () => anchorRect() ?? { x: 0, y: 0, width: 0, height: 0 },
  );
  const hasAnchor = createMemo(() => anchorRect() !== null);

  // Below the element at the pointer's x, or under the anchor element (a
  // pin) from its left edge; flipping above when it does not fit, kept
  // inside the visible viewport.
  const floating = createFloating({
    reference: () =>
      hasAnchor() ? (props.anchorElement ?? labelReference) : null,
    floating: container,
    watch: anchorRect,
    options: () => ({
      placement: props.anchorElement ? "bottom-start" : "bottom",
      fallbackPlacements: [props.anchorElement ? "top-start" : "top"],
      offsetPx: arrowHeight() + LABEL_GAP_PX,
      paddingPx: VIEWPORT_MARGIN_PX,
      shiftCrossAxis: true,
      boundary: visibleViewport(),
      arrowElement: arrowElement(),
      arrowPaddingPx: ARROW_LABEL_MARGIN_PX,
    }),
  });

  // A new element starts without a position of its own.
  createEffect(on(elementIdentity, () => floating.reset(), { defer: true }));

  const isPlaced = () => {
    const current = anchor();
    return (
      current.kind === "track" || (current.kind === "keep" && hadValidBounds())
    );
  };

  // Unplaced labels are transparent and inert rather than visibility:hidden,
  // so the prompt textarea can take focus as soon as the label mounts.
  const isShown = () => isPlaced() && floating.position() !== null;

  const arrowPosition = (): ArrowPosition =>
    floating.position()?.side === "top" ? "top" : "bottom";

  createEffect(
    on(
      () => props.selectionLabelShakeCount,
      () => setIsShaking(true),
      { defer: true },
    ),
  );

  const shouldPersistDuringFade = () =>
    hadValidBounds() && (isCompletedStatus() || props.status === "error");

  const contextValue: SelectionLabelContextValue = {
    status: () => props.status,
    canInteract,
    isPromptMode: () => Boolean(props.isPromptMode),
    arrowPosition,
    isDevMode,
  };

  return (
    <Show
      when={
        props.visible !== false &&
        (props.selectionBounds || shouldPersistDuringFade())
      }
    >
      <div
        ref={(element) => {
          containerRef = element;
          setContainer(element);
        }}
        data-react-grab-ignore-events
        data-react-grab-selection-label
        class={cn(
          "fixed text-body antialiased drop-shadow-overlay select-none transition-opacity duration-100 ease-out",
          props.isCollapsing
            ? "animate-out fade-out-0 zoom-out-95 duration-150 ease-in fill-mode-forwards origin-top"
            : props.anchorElement &&
                "animate-in fade-in-0 zoom-in-95 duration-200 ease-out origin-top",
        )}
        style={{
          left: floating.style().left,
          top: floating.style().top,
          "z-index": "var(--z-overlay)",
          "pointer-events":
            isShown() && shouldEnablePointerEvents() ? "auto" : "none",
          opacity:
            !isShown() || props.status === "fading" || isInternalFading()
              ? 0
              : 1,
        }}
        onClick={(event) => {
          event.stopImmediatePropagation();
        }}
        onMouseEnter={() => props.onHoverChange?.(true)}
        onMouseLeave={() => props.onHoverChange?.(false)}
      >
        <Show when={!props.hideArrow}>
          <Arrow
            ref={setArrowElement}
            position={arrowPosition()}
            left={floating.position()?.arrowX}
            labelWidth={panelWidth()}
          />
        </Show>

        <Show when={isCompletedStatus() && !props.error}>
          <CompletionView
            statusText={
              props.hasAgent ? (props.statusText ?? "Completed") : "Copied"
            }
            supportsUndo={props.supportsUndo}
            supportsFollowUp={props.supportsFollowUp}
            dismissButtonText={props.dismissButtonText}
            previousPrompt={props.previousPrompt}
            onDismiss={props.onDismiss}
            onUndo={props.onUndo}
            onFollowUpSubmit={props.onFollowUpSubmit}
            onFadingChange={setIsInternalFading}
            onShowContextMenu={props.onShowContextMenu}
          />
        </Show>

        <div
          ref={panelRef}
          class={cn(
            "relative contain-layout flex items-center gap-[5px] rounded-[10px] antialiased h-fit p-0 [font-synthesis:none] [corner-shape:superellipse(1.25)]",
            "bg-popover",
            props.jiraFlagged && FLAGGED_BORDER_CLASS,
            isShaking() && "animate-shake",
          )}
          style={{
            display: isCompletedStatus() && !props.error ? "none" : undefined,
          }}
          onAnimationEnd={() => setIsShaking(false)}
        >
          <Show
            when={canInteract() && props.onRemoveItem && !props.jiraTicketId}
          >
            <div class="absolute -top-2 -right-2 z-10">
              <RemoveSelectionButton
                variant="overlay"
                onRemove={() => props.onRemoveItem?.()}
              />
            </div>
          </Show>

          <SelectionLabelProvider value={contextValue}>
            {props.children}
          </SelectionLabelProvider>
        </div>
      </div>
    </Show>
  );
};

export const SelectionLabel = Object.assign(SelectionLabelRoot, {
  Root: SelectionLabelRoot,
  Header: SelectionLabelHeader,
  Content: SelectionLabelContent,
  ContextInput: SelectionLabelContextInput,
  DevInsights: DevInsightsSection,
});
