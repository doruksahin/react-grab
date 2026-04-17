import {
  Show,
  createSignal,
  createEffect,
  createMemo,
  on,
  onMount,
  onCleanup,
} from 'solid-js';
import type { Component } from 'solid-js';
import type { ArrowPosition } from '../../types.js';
import type { SelectionLabelRootProps } from './types.js';
import type { SelectionLabelContextValue } from './context.js';
import {
  VIEWPORT_MARGIN_PX,
  ARROW_CENTER_PERCENT,
  ARROW_LABEL_MARGIN_PX,
  LABEL_GAP_PX,
  SELECTION_LABEL_OFFSCREEN_PX,
} from '../../constants.js';
import { getArrowSize } from '../../utils/get-arrow-size.js';
import { isKeyboardEventTriggeredByInput } from '../../utils/is-keyboard-event-triggered-by-input.js';
import { cn } from '../../utils/cn.js';
import { RemoveSelectionButton } from '../remove-selection-button.jsx';
import { FLAGGED_BORDER_CLASS } from '../../features/sidebar/resolve-display-color.js';
import { Arrow } from './arrow.js';
import { CompletionView } from './completion-view.js';
import { SelectionLabelProvider } from './context.js';
import { useDevMode } from '../../features/dev-mode/index.js';

interface LabelPosition {
  left: number;
  top: number;
  arrowLeftPercent: number;
  arrowLeftOffset: number;
  edgeOffsetX: number;
}

const DEFAULT_OFFSCREEN_POSITION: LabelPosition = {
  left: SELECTION_LABEL_OFFSCREEN_PX,
  top: SELECTION_LABEL_OFFSCREEN_PX,
  arrowLeftPercent: ARROW_CENTER_PERCENT,
  arrowLeftOffset: 0,
  edgeOffsetX: 0,
};

interface PositionResult {
  position: LabelPosition;
  computedArrowPosition: ArrowPosition | null;
  hadValidBounds: boolean;
  elementIdentity: string;
}

export const SelectionLabelRoot: Component<SelectionLabelRootProps> = (props) => {
  const isDevMode = useDevMode();
  let containerRef: HTMLDivElement | undefined;
  let panelRef: HTMLDivElement | undefined;

  const [measuredWidth, setMeasuredWidth] = createSignal(0);
  const [measuredHeight, setMeasuredHeight] = createSignal(0);
  const [panelWidth, setPanelWidth] = createSignal(0);
  const [viewportVersion, setViewportVersion] = createSignal(0);
  const [isInternalFading, setIsInternalFading] = createSignal(false);
  const [isShaking, setIsShaking] = createSignal(false);

  const canInteract = () =>
    props.status !== 'copying' &&
    props.status !== 'copied' &&
    props.status !== 'fading' &&
    props.status !== 'error';

  const isCompletedStatus = () =>
    props.status === 'copied' || props.status === 'fading';

  const shouldEnablePointerEvents = (): boolean => {
    if (props.isPromptMode) return true;
    if (isCompletedStatus() && (props.onDismiss || props.onShowContextMenu)) {
      return true;
    }
    if (props.status === 'copying' && props.onAbort) return true;
    if (
      props.status === 'error' &&
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
      event.code === 'Enter' && !props.isPromptMode && canInteract();
    const isCtrlCToAbort =
      event.code === 'KeyC' &&
      event.ctrlKey &&
      props.status === 'copying' &&
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
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);
    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
  });

  onCleanup(() => {
    resizeObserver?.disconnect();
    window.removeEventListener('scroll', handleViewportChange, true);
    window.removeEventListener('resize', handleViewportChange);
    window.visualViewport?.removeEventListener('resize', handleViewportChange);
    window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    window.removeEventListener('keydown', handleGlobalKeyDown, {
      capture: true,
    });
  });

  const elementIdentity = () =>
    `${props.tagName ?? ''}:${props.componentName ?? ''}`;

  const positionComputation = createMemo(
    (previousResult: PositionResult): PositionResult => {
      viewportVersion();
      const currentElementIdentity = elementIdentity();
      const didReset =
        currentElementIdentity !== previousResult.elementIdentity;
      const cached: PositionResult = didReset
        ? {
            position: DEFAULT_OFFSCREEN_POSITION,
            computedArrowPosition: null,
            hadValidBounds: false,
            elementIdentity: currentElementIdentity,
          }
        : previousResult;

      const bounds = props.selectionBounds;
      const labelWidth = measuredWidth();
      const labelHeight = measuredHeight();
      const hasMeasurements = labelWidth > 0 && labelHeight > 0;
      const hasValidBounds = bounds && bounds.width > 0 && bounds.height > 0;

      if (!hasMeasurements || !hasValidBounds) {
        return {
          position: cached.hadValidBounds
            ? cached.position
            : DEFAULT_OFFSCREEN_POSITION,
          computedArrowPosition: cached.computedArrowPosition,
          hadValidBounds: cached.hadValidBounds,
          elementIdentity: currentElementIdentity,
        };
      }

      const visualViewport = window.visualViewport;
      const viewportLeft = visualViewport?.offsetLeft ?? 0;
      const viewportTop = visualViewport?.offsetTop ?? 0;
      const viewportRight =
        viewportLeft + (visualViewport?.width ?? window.innerWidth);
      const viewportBottom =
        viewportTop + (visualViewport?.height ?? window.innerHeight);

      const isSelectionVisibleInViewport =
        bounds.x + bounds.width > viewportLeft &&
        bounds.x < viewportRight &&
        bounds.y + bounds.height > viewportTop &&
        bounds.y < viewportBottom;

      if (!isSelectionVisibleInViewport) {
        return {
          position: DEFAULT_OFFSCREEN_POSITION,
          computedArrowPosition: cached.computedArrowPosition,
          hadValidBounds: cached.hadValidBounds,
          elementIdentity: currentElementIdentity,
        };
      }

      const selectionCenterX = bounds.x + bounds.width / 2;
      const cursorX = props.mouseX ?? selectionCenterX;
      const selectionBottom = bounds.y + bounds.height;
      const selectionTop = bounds.y;

      const actualArrowHeight = props.hideArrow
        ? 0
        : getArrowSize(panelWidth());

      // HACK: Use cursorX as anchor point, CSS transform handles centering via translateX(-50%)
      const anchorX = cursorX;
      let edgeOffsetX = 0;
      const extraOffset = props.extraTopOffset ?? 0;
      let positionTop = selectionBottom + actualArrowHeight + LABEL_GAP_PX + extraOffset;

      if (labelWidth > 0) {
        const labelLeft = anchorX - labelWidth / 2;
        const labelRight = anchorX + labelWidth / 2;

        if (labelRight > viewportRight - VIEWPORT_MARGIN_PX) {
          edgeOffsetX = viewportRight - VIEWPORT_MARGIN_PX - labelRight;
        }
        if (labelLeft + edgeOffsetX < viewportLeft + VIEWPORT_MARGIN_PX) {
          edgeOffsetX = viewportLeft + VIEWPORT_MARGIN_PX - labelLeft;
        }
      }

      const totalHeightNeeded = labelHeight + actualArrowHeight + LABEL_GAP_PX + extraOffset;
      const fitsBelow =
        positionTop + labelHeight <= viewportBottom - VIEWPORT_MARGIN_PX;
      let placement: "above" | "below" = "below";

      if (!fitsBelow) {
        positionTop = selectionTop - totalHeightNeeded;
        placement = "above";
      }

      if (positionTop < viewportTop + VIEWPORT_MARGIN_PX) {
        positionTop = viewportTop + VIEWPORT_MARGIN_PX;
      }

      props.onPlacementChange?.(placement);

      const arrowLeftPercent = ARROW_CENTER_PERCENT;
      const labelHalfWidth = labelWidth / 2;
      const arrowCenterPx = labelHalfWidth - edgeOffsetX;
      const arrowMinPx = Math.min(ARROW_LABEL_MARGIN_PX, labelHalfWidth);
      const arrowMaxPx = Math.max(
        labelWidth - ARROW_LABEL_MARGIN_PX,
        labelHalfWidth
      );
      const clampedArrowCenterPx = Math.max(
        arrowMinPx,
        Math.min(arrowMaxPx, arrowCenterPx)
      );
      const arrowLeftOffset = clampedArrowCenterPx - labelHalfWidth;

      const computedArrowPosition: ArrowPosition = fitsBelow ? 'bottom' : 'top';

      return {
        position: {
          left: anchorX,
          top: positionTop,
          arrowLeftPercent,
          arrowLeftOffset,
          edgeOffsetX,
        },
        computedArrowPosition,
        hadValidBounds: true,
        elementIdentity: currentElementIdentity,
      };
    },
    {
      position: DEFAULT_OFFSCREEN_POSITION,
      computedArrowPosition: null,
      hadValidBounds: false,
      elementIdentity: '',
    } satisfies PositionResult
  );

  const arrowPosition = () =>
    positionComputation().computedArrowPosition ?? 'bottom';
  const hadValidBounds = () => positionComputation().hadValidBounds;

  createEffect(
    on(
      () => props.selectionLabelShakeCount,
      () => setIsShaking(true),
      { defer: true }
    )
  );

  const shouldPersistDuringFade = () =>
    hadValidBounds() && (isCompletedStatus() || props.status === 'error');

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
        ref={containerRef}
        data-react-grab-ignore-events
        data-react-grab-selection-label
        class={cn(
          'fixed text-[13px] antialiased filter-[drop-shadow(0px_1px_2px_#51515140)] select-none transition-opacity duration-100 ease-out',
          props.isCollapsing
            ? 'animate-out fade-out-0 zoom-out-95 duration-150 ease-in fill-mode-forwards origin-top'
            : props.onCollapse &&
                'animate-in fade-in-0 zoom-in-95 duration-200 ease-out origin-top'
        )}
        style={{
          top: `${positionComputation().position.top}px`,
          left: `${positionComputation().position.left}px`,
          translate: `calc(-50% + ${positionComputation().position.edgeOffsetX}px) 0`,
          'z-index': 'var(--z-overlay)',
          'pointer-events': shouldEnablePointerEvents() ? 'auto' : 'none',
          opacity: props.status === 'fading' || isInternalFading() ? 0 : 1,
        }}
        onClick={(event) => {
          event.stopImmediatePropagation();
        }}
        onMouseEnter={() => props.onHoverChange?.(true)}
        onMouseLeave={() => props.onHoverChange?.(false)}
      >
        <Show when={!props.hideArrow}>
          <Arrow
            position={arrowPosition()}
            leftPercent={positionComputation().position.arrowLeftPercent}
            leftOffsetPx={positionComputation().position.arrowLeftOffset}
            labelWidth={panelWidth()}
          />
        </Show>

        <Show when={isCompletedStatus() && !props.error}>
          <CompletionView
            statusText={
              props.hasAgent ? (props.statusText ?? 'Completed') : 'Copied'
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
            'relative contain-layout flex items-center gap-[5px] rounded-[10px] antialiased h-fit p-0 [font-synthesis:none] [corner-shape:superellipse(1.25)]',
            'bg-popover',
            props.jiraFlagged && FLAGGED_BORDER_CLASS,
            isShaking() && 'animate-shake'
          )}
          style={{
            display: isCompletedStatus() && !props.error ? 'none' : undefined,
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

export { SelectionLabelRoot as SelectionLabel };
