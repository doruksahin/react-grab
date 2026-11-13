import {
  getElementsAtPoint,
  isElementGrabbable,
} from "react-grab-upstream/primitives";
import {
  init as initUpstream,
  type ReactGrabAPI as UpstreamAPI,
} from "react-grab-upstream/core";
import { resolveSource } from "element-source";
import { getVisibleBoundsCenter } from "../utils/get-visible-bounds-center.js";
import {
  batch,
  createEffect,
  createMemo,
  createResource,
  createRoot,
  createSignal,
  on,
  onCleanup,
} from "solid-js";
import { render } from "solid-js/web";
// @ts-expect-error - CSS imported as text via tsup loader
import cssText from "../../dist/styles.css";
import {
  loadToolbarState,
  saveToolbarState,
} from "../components/toolbar/state.js";
import {
  ACTION_CYCLE_IDLE_TRIGGER_MS,
  BOUNDS_RECALC_INTERVAL_MS,
  COMPONENT_NAME_DEBOUNCE_MS,
  DEFAULT_ACTION_ID,
  DEFAULT_KEY_HOLD_DURATION_MS,
  DEFAULT_MAX_CONTEXT_LINES,
  DRAG_PREVIEW_DEBOUNCE_MS,
  DRAG_THRESHOLD_PX,
  DROPDOWN_HOVER_OPEN_DELAY_MS,
  FADE_COMPLETE_BUFFER_MS,
  FEEDBACK_DURATION_MS,
  MAX_COMMENT_ITEMS,
  NEXTJS_REVALIDATION_DELAY_MS,
  TOOLBAR_DEFAULT_POSITION_RATIO,
  ZOOM_DETECTION_THRESHOLD,
} from "../constants.js";
import { captureAndUploadScreenshots } from "../features/screenshot/index.js";
import { groupComments } from "../features/selection-groups/business/group-operations.js";
import { isSynthetic } from "../features/selection-groups/business/synthetic-group.js";
import { createSelectionGroups } from "../features/selection-groups/index.js";
import type { SelectionGroup } from "../features/selection-groups/types.js";
import { createSelectionVisibility } from "../features/selection-visibility/index.js";
import type { SelectionGroupWithJira } from "../features/sidebar/jira-types.js";
import { createSyncLayer } from "../features/sync/sync-layer.js";
import type { SyncConfig, SyncStatus } from "../features/sync/types.js";
import {
  addJiraComment,
  getJiraTicketStatus,
  searchJiraUsers,
} from "../generated/sync-api.js";
import type {
  ActionCycleItem,
  ActionCycleState,
  AgentOptions,
  AgentSession,
  ArrowNavigationState,
  CommentItem,
  ContextMenuAction,
  ContextMenuActionContext,
  DropdownAnchor,
  GrabbedBox,
  Options,
  OverlayBounds,
  PerformWithFeedbackOptions,
  Plugin,
  Position,
  ReactGrabAPI,
  ReactGrabState,
  SelectionLabelInstance,
  SettableOptions,
  SourceInfo,
  ToolbarState,
} from "../types.js";
import { confirmClear, isClearConfirmed } from "../utils/clear-confirmation.js";
import { combineBounds } from "../utils/combine-bounds.js";
import {
  copyContent,
  copyGroupedContent,
  type ReactGrabGroup,
} from "../utils/copy-content.js";
import {
  createBoundsFromDragRect,
  createFlatOverlayBounds,
  createPageRectFromBounds,
} from "../utils/create-bounds-from-drag-rect.js";
import {
  createElementBounds,
  invalidateBoundsCache,
} from "../utils/create-element-bounds.js";
import { createElementSelector } from "../utils/create-element-selector.js";
import { getPageContext } from "../utils/get-page-context.js";
import { generateId } from "../utils/generate-id.js";
import { generateSnippet } from "../utils/generate-snippet.js";
import { getAncestorElements } from "../utils/get-ancestor-elements.js";
import { getBoundsCenter } from "../utils/get-bounds-center.js";
import { getElementBoundsCenter } from "../utils/get-element-bounds-center.js";
import { getElementsInDrag } from "../utils/get-elements-in-drag.js";
import { getNearestEdge } from "../utils/get-nearest-edge.js";
import { getScriptOptions } from "../utils/get-script-options.js";
import { getTagName } from "../utils/get-tag-name.js";
import { isElementConnected } from "../utils/is-element-connected.js";
import { isEventFromOverlay } from "../utils/is-event-from-overlay.js";
import { isKeyboardEventTriggeredByInput } from "../utils/is-keyboard-event-triggered-by-input.js";
import { isRootElement } from "../utils/is-root-element.js";
import {
  joinGroupedSnippets,
  joinSnippets,
  type GroupedSnippet,
} from "../utils/join-snippets.js";
import { keyMatchesCode } from "../utils/key-matches-code.js";
import { logRecoverableError } from "../utils/log-recoverable-error.js";
import { mountRoot } from "../utils/mount-root.js";
import {
  nativeCancelAnimationFrame,
  nativeRequestAnimationFrame,
} from "../utils/native-raf.js";
import { normalizeErrorMessage } from "../utils/normalize-error.js";
import { getModifiersFromActivationKey } from "../utils/parse-activation-key.js";
import { resolveActionEnabled } from "../utils/resolve-action-enabled.js";
import { createAgentManager } from "./agent/manager.js";
import { createAutoScroller } from "./auto-scroll.js";
import {
  checkIsNextProject,
  getComponentDisplayName,
  getNearestComponentName,
  getStackContext,
} from "./context.js";
import { createEventListenerManager } from "./events.js";
import { logIntro } from "./log-intro.js";
import { createNoopApi } from "./noop-api.js";
import { createPluginRegistry } from "./plugin-registry.js";
import { commentPlugin } from "./plugins/comment.js";
import { copyHtmlPlugin } from "./plugins/copy-html.js";
import { copyStylesPlugin } from "./plugins/copy-styles.js";
import { copyPlugin } from "./plugins/copy.js";
import { openPlugin } from "./plugins/open.js";
import { createGrabStore } from "./store.js";
import { DEFAULT_THEME } from "./theme.js";

const builtInPlugins = [
  copyPlugin,
  commentPlugin,
  copyHtmlPlugin,
  copyStylesPlugin,
  openPlugin,
];

interface PendingSubmission {
  elements: Element[];
  prompt: string;
  groupId: string | null;
  position: Position;
}

interface BuildActionContextOptions {
  element: Element;
  filePath: string | undefined;
  lineNumber: number | undefined;
  tagName: string | undefined;
  componentName: string | undefined;
  position: Position;
  performWithFeedbackOptions?: PerformWithFeedbackOptions;
  shouldDeferHideContextMenu: boolean;
  onBeforeCopy?: () => void;
  onBeforePrompt?: () => void;
  customEnterPromptMode?: (agent?: AgentOptions) => void;
}

const syncLayer = createSyncLayer();
let pendingSyncOptions: Options | undefined;

export const initSync = async (config: SyncConfig): Promise<void> => {
  if (config.options) {
    pendingSyncOptions = config.options;
  }
  await syncLayer.init(config);
};

export const populateSync = syncLayer.populate;

let hasInited = false;
const toolbarStateChangeCallbacks = new Set<(state: ToolbarState) => void>();

export const init = (rawOptions?: Options): ReactGrabAPI => {
  if (typeof window === "undefined") {
    return createNoopApi();
  }

  const scriptOptions = getScriptOptions();

  const initialOptions: Options = {
    enabled: true,
    activationMode: "toggle",
    keyHoldDuration: DEFAULT_KEY_HOLD_DURATION_MS,
    allowActivationInsideInput: true,
    maxContextLines: DEFAULT_MAX_CONTEXT_LINES,
    ...scriptOptions,
    ...pendingSyncOptions,
    ...rawOptions,
  };

  if (initialOptions.enabled === false || hasInited) {
    return createNoopApi();
  }
  hasInited = true;

  logIntro();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- need to omit enabled from settableOptions to avoid circular dependency
  const { enabled: _enabled, ...settableOptions } = initialOptions;

  return createRoot((dispose) => {
    let disposed = false;
    let engine: UpstreamAPI | undefined;
    let pendingSubmission: PendingSubmission | undefined;
    let disposeRenderer: (() => void) | undefined;

    const pluginRegistry = createPluginRegistry(settableOptions);

    const getAgentFromActions = () => {
      for (const action of pluginRegistry.store.actions) {
        if (action.agent?.provider) {
          return action.agent;
        }
      }
      return undefined;
    };

    const { store, actions } = createGrabStore({
      theme: DEFAULT_THEME,
      hasAgentProvider: Boolean(getAgentFromActions()?.provider),
      keyHoldDuration:
        pluginRegistry.store.options.keyHoldDuration ??
        DEFAULT_KEY_HOLD_DURATION_MS,
    });

    const isHoldingKeys = createMemo(() => store.current.state === "holding");
    const isActivated = createMemo(() => store.current.state === "active");
    const isFrozenPhase = createMemo(
      () =>
        store.current.state === "active" && store.current.phase === "frozen",
    );
    const isDragging = createMemo(
      () =>
        store.current.state === "active" && store.current.phase === "dragging",
    );
    const isCopying = createMemo(() => store.current.state === "copying");
    const didJustCopy = createMemo(() => store.current.state === "justCopied");
    const isPromptMode = createMemo(
      () =>
        store.current.state === "active" && Boolean(store.current.isPromptMode),
    );
    const isCommentMode = createMemo(
      () => store.pendingCommentMode || isPromptMode(),
    );
    const isPendingDismiss = createMemo(
      () =>
        store.current.state === "active" &&
        Boolean(store.current.isPromptMode) &&
        Boolean(store.current.isPendingDismiss),
    );

    const savedToolbarState = loadToolbarState();
    const [isEnabled] = createSignal(true);
    const [isDevMode, setIsDevMode] = createSignal(
      savedToolbarState?.devMode ?? false,
    );
    const [toolbarShakeCount] = createSignal(0);
    const [selectionLabelShakeCount, setSelectionLabelShakeCount] =
      createSignal(0);
    const [currentToolbarState, setCurrentToolbarState] =
      createSignal<ToolbarState | null>(savedToolbarState);
    const [isToolbarSelectHovered, setIsToolbarSelectHovered] =
      createSignal(false);
    const commentItems = syncLayer.comments;
    const setCommentItems: import("solid-js").Setter<CommentItem[]> = ((
      itemsOrFn: unknown,
    ) => {
      const next =
        typeof itemsOrFn === "function"
          ? itemsOrFn(syncLayer.comments())
          : itemsOrFn;
      syncLayer.setComments(next as CommentItem[]);
    }) as import("solid-js").Setter<CommentItem[]>;

    const persistCommentItems = syncLayer.persistComments;
    const getActiveAdapter = syncLayer.adapter;

    const addCommentItem = (item: Omit<CommentItem, "id">): CommentItem[] =>
      syncLayer.persistComments(
        [{ ...item, id: generateId("comment") }, ...syncLayer.comments()].slice(
          0,
          MAX_COMMENT_ITEMS,
        ),
      );

    const removeCommentItem = (itemId: string): CommentItem[] =>
      syncLayer.persistComments(
        syncLayer.comments().filter((i) => i.id !== itemId),
      );

    const patchCommentItem = (
      id: string,
      patch: Partial<CommentItem>,
    ): CommentItem[] =>
      syncLayer.persistComments(
        syncLayer.comments().map((i) => (i.id === id ? { ...i, ...patch } : i)),
      );

    const clearComments = (): CommentItem[] => syncLayer.persistComments([]);

    const derivedSyncStatus = (): SyncStatus => {
      const s = syncLayer.status();
      if (s === "synced" || s === "error") return s;
      return "local";
    };

    const [commentsDropdownPosition, setCommentsDropdownPosition] =
      createSignal<DropdownAnchor | null>(null);
    const [toolbarMenuPosition, setToolbarMenuPosition] =
      createSignal<DropdownAnchor | null>(null);
    const [clearPromptPosition, setClearPromptPosition] =
      createSignal<DropdownAnchor | null>(null);
    let toolbarElement: HTMLDivElement | undefined;
    let dropdownTrackingFrameId: number | null = null;
    const commentElementMap = new Map<string, Element[]>();
    const [clockFlashTrigger, setClockFlashTrigger] = createSignal(0);
    const [isCommentsHoverOpen, setIsCommentsHoverOpen] = createSignal(false);
    let commentsHoverPreviews: { boxId: string; labelId: string | null }[] = [];

    // Incremented when DOM structure changes (host app mounts/unmounts elements).
    // Used by commentsDisconnectedItemIds to re-evaluate element connectivity.
    const [domMutationVersion, setDomMutationVersion] = createSignal(0);
    const domObserver = new MutationObserver(() => {
      setDomMutationVersion((v) => v + 1);
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
    onCleanup(() => domObserver.disconnect());

    const updateToolbarState = (updates: Partial<ToolbarState>) => {
      const currentState = currentToolbarState() ?? loadToolbarState();
      const newState: ToolbarState = {
        edge: currentState?.edge ?? "bottom",
        ratio: currentState?.ratio ?? TOOLBAR_DEFAULT_POSITION_RATIO,
        collapsed: currentState?.collapsed ?? false,
        enabled: currentState?.enabled ?? true,
        devMode: currentState?.devMode ?? false,
        defaultAction: currentState?.defaultAction ?? DEFAULT_ACTION_ID,
        selectionsRevealed: currentState?.selectionsRevealed ?? false,
        ...updates,
      };
      saveToolbarState(newState);
      setCurrentToolbarState(newState);
      for (const callback of toolbarStateChangeCallbacks) {
        callback(newState);
      }
      return newState;
    };

    const getMappedCommentElements = (commentItemId: string): Element[] =>
      commentElementMap.get(commentItemId) ?? [];

    const reacquireCommentElements = (commentItem: CommentItem): Element[] => {
      const selectors = commentItem.elementSelectors ?? [];
      if (selectors.length === 0) return [];

      const reacquiredElements: Element[] = [];
      for (const selector of selectors) {
        if (!selector) continue;
        try {
          const reacquiredElement = document.querySelector(selector);
          if (isElementConnected(reacquiredElement)) {
            reacquiredElements.push(reacquiredElement);
          }
          // HACK: querySelector can throw on invalid selectors stored from previous sessions
        } catch (error) {
          logRecoverableError("Invalid stored selector", error);
        }
      }
      return reacquiredElements;
    };

    const getConnectedCommentElements = (
      commentItem: CommentItem,
    ): Element[] => {
      const mappedElements = getMappedCommentElements(commentItem.id);
      const connectedMappedElements = mappedElements.filter((mappedElement) =>
        isElementConnected(mappedElement),
      );
      const areAllMappedElementsConnected =
        mappedElements.length > 0 &&
        connectedMappedElements.length === mappedElements.length;

      if (areAllMappedElementsConnected) {
        return connectedMappedElements;
      }

      const reacquiredElements = reacquireCommentElements(commentItem);
      if (reacquiredElements.length > 0) {
        commentElementMap.set(commentItem.id, reacquiredElements);
        return reacquiredElements;
      }

      return connectedMappedElements;
    };

    const getFirstConnectedCommentElement = (
      commentItem: CommentItem,
    ): Element | undefined => getConnectedCommentElements(commentItem)[0];

    /**
     * Returns the id of the CommentItem backing the currently focused
     * (frozen) selection element, if any. Used to route "active group"
     * changes from the selection-label picker through handleMoveItem so
     * the change is persisted to the server — not just a change to the
     * global "next new selection" default group.
     */
    const findFocusedCommentItemId = (): string | undefined => {
      const focusedEl = store.frozenElements[0];
      if (!focusedEl) return undefined;
      return commentItems().find((item) =>
        getConnectedCommentElements(item).includes(focusedEl),
      )?.id;
    };

    const commentsDisconnectedItemIds = createMemo(
      () => {
        void commentsDropdownPosition();
        void domMutationVersion();
        const disconnectedIds = new Set<string>();
        for (const item of commentItems()) {
          if (getConnectedCommentElements(item).length === 0) {
            disconnectedIds.add(item.id);
          }
        }
        return disconnectedIds;
      },
      undefined,
      {
        equals: (prev, next) => {
          if (prev.size !== next.size) return false;
          for (const id of next) {
            if (!prev.has(id)) return false;
          }
          return true;
        },
      },
    );

    const copyableItemCount = createMemo(() => {
      const disconnected = commentsDisconnectedItemIds();
      return commentItems().filter(
        (item) => item.revealed && !disconnected.has(item.id),
      ).length;
    });

    const clearHoldTimer = () => {
      if (activationHoldState.timerId !== null) {
        clearTimeout(activationHoldState.timerId);
        activationHoldState.timerId = null;
      }
    };

    createEffect(() => {
      if (store.current.state !== "holding") {
        clearHoldTimer();
        return;
      }
      activationHoldState.startTimestamp = Date.now();
      activationHoldState.timerId = window.setTimeout(() => {
        activationHoldState.timerId = null;
        if (activationHoldState.copyWaiting) {
          activationHoldState.holdTimerFired = true;
          return;
        }
        actions.activate();
      }, store.keyHoldDuration);
      onCleanup(clearHoldTimer);
    });

    createEffect(() => {
      if (
        store.current.state !== "active" ||
        store.current.phase !== "justDragged"
      )
        return;
      const timerId = setTimeout(() => {
        actions.finishJustDragged();
      }, FEEDBACK_DURATION_MS);
      onCleanup(() => clearTimeout(timerId));
    });

    createEffect(() => {
      if (store.current.state !== "justCopied") return;
      const timerId = setTimeout(() => {
        actions.finishJustCopied();
      }, FEEDBACK_DURATION_MS);
      onCleanup(() => clearTimeout(timerId));
    });

    createEffect(
      on(isHoldingKeys, (currentlyHolding, previouslyHolding = false) => {
        if (!previouslyHolding || currentlyHolding || !isActivated()) {
          return;
        }
        if (pluginRegistry.store.options.activationMode !== "hold") {
          actions.setWasActivatedByToggle(true);
        }
        pluginRegistry.hooks.onActivate();
      }),
    );

    const preparePromptMode = (
      element: Element,
      positionX: number,
      positionY: number,
    ) => {
      setCopyStartPosition(element, positionX, positionY);
      actions.clearInputText();
    };

    const activatePromptMode = () => {
      const element = store.frozenElement || targetElement();
      if (element) {
        actions.enterPromptMode(
          { x: store.pointer.x, y: store.pointer.y },
          element,
        );
      }
    };

    const setCopyStartPosition = (
      element: Element,
      positionX: number,
      positionY: number,
    ) => {
      actions.setCopyStart({ x: positionX, y: positionY }, element);
      return createElementBounds(element);
    };

    let dragPreviewDebounceTimerId: number | null = null;
    const [debouncedDragPointer, setDebouncedDragPointer] = createSignal<{
      x: number;
      y: number;
    } | null>(null);
    const scheduleDragPreviewUpdate = (clientX: number, clientY: number) => {
      if (dragPreviewDebounceTimerId !== null) {
        clearTimeout(dragPreviewDebounceTimerId);
      }
      setDebouncedDragPointer(null);
      dragPreviewDebounceTimerId = window.setTimeout(() => {
        setDebouncedDragPointer({ x: clientX, y: clientY });
        dragPreviewDebounceTimerId = null;
      }, DRAG_PREVIEW_DEBOUNCE_MS);
    };
    let keydownSpamTimerId: number | null = null;
    const activationHoldState = {
      timerId: null as number | null,
      startTimestamp: null as number | null,
      copyWaiting: false,
      holdTimerFired: false,
    };
    const [isInspectMode, setIsInspectMode] = createSignal(false);
    let actionCycleIdleTimeoutId: number | null = null;
    let selectionSourceRequestVersion = 0;
    let componentNameRequestVersion = 0;
    let componentNameDebounceTimerId: number | null = null;
    let isPendingContextMenuSelect = false;
    let pendingDefaultActionId: string | null = null;
    const [
      debouncedElementForComponentName,
      setDebouncedElementForComponentName,
    ] = createSignal<Element | null>(null);
    const [resolvedComponentName, setResolvedComponentName] = createSignal<
      string | undefined
    >(undefined);
    const [actionCycleItems, setActionCycleItems] = createSignal<
      ActionCycleItem[]
    >([]);
    const [actionCycleActiveIndex, setActionCycleActiveIndex] = createSignal<
      number | null
    >(null);

    const [arrowNavigationElements, setArrowNavigationElements] = createSignal<
      Element[]
    >([]);
    const [arrowNavigationActiveIndex, setArrowNavigationActiveIndex] =
      createSignal(0);

    const autoScroller = createAutoScroller(
      () => store.pointer,
      () => isDragging(),
    );

    const isRendererActive = createMemo(() => isActivated() && !isCopying());

    const grabbedBoxTimeouts = new Map<string, number>();

    const showTemporaryGrabbedBox = (
      bounds: OverlayBounds,
      element: Element,
    ) => {
      const boxId = generateId("grabbed");
      const createdAt = Date.now();
      const newBox: GrabbedBox = { id: boxId, bounds, createdAt, element };

      actions.addGrabbedBox(newBox);
      pluginRegistry.hooks.onGrabbedBox(bounds, element);

      const timeoutId = window.setTimeout(() => {
        grabbedBoxTimeouts.delete(boxId);
        actions.removeGrabbedBox(boxId);
      }, FEEDBACK_DURATION_MS);
      grabbedBoxTimeouts.set(boxId, timeoutId);
    };

    const labelFadeTimeouts = new Map<string, number>();

    const cancelLabelFade = (instanceId: string) => {
      const existingTimeout = labelFadeTimeouts.get(instanceId);
      if (existingTimeout !== undefined) {
        window.clearTimeout(existingTimeout);
        labelFadeTimeouts.delete(instanceId);
      }
    };

    const cancelAllLabelFades = () => {
      for (const timeoutId of labelFadeTimeouts.values()) {
        window.clearTimeout(timeoutId);
      }
      labelFadeTimeouts.clear();
    };

    const scheduleLabelFade = (instanceId: string) => {
      cancelLabelFade(instanceId);

      const timeoutId = window.setTimeout(() => {
        labelFadeTimeouts.delete(instanceId);
        actions.updateLabelInstance(instanceId, "fading");
        setTimeout(() => {
          labelFadeTimeouts.delete(instanceId);
          actions.removeLabelInstance(instanceId);
        }, FADE_COMPLETE_BUFFER_MS);
      }, FEEDBACK_DURATION_MS);

      labelFadeTimeouts.set(instanceId, timeoutId);
    };

    const handleLabelInstanceHoverChange = (
      instanceId: string,
      isHovered: boolean,
    ) => {
      if (isHovered) {
        cancelLabelFade(instanceId);
      } else {
        const instance = store.labelInstances.find(
          (labelInstance) => labelInstance.id === instanceId,
        );
        if (instance && instance.status === "copied") {
          scheduleLabelFade(instanceId);
        }
      }
    };

    const createLabelInstance = (
      bounds: OverlayBounds,
      tagName: string,
      componentName: string | undefined,
      status: SelectionLabelInstance["status"],
      options?: {
        element?: Element;
        mouseX?: number;
        elements?: Element[];
        boundsMultiple?: OverlayBounds[];
        hideArrow?: boolean;
      },
    ): string => {
      for (const instance of store.labelInstances) {
        if (!instance.itemId) actions.removeLabelInstance(instance.id);
      }
      cancelAllLabelFades();
      const instanceId = generateId("label");
      const boundsCenterX = bounds.x + bounds.width / 2;
      const boundsHalfWidth = bounds.width / 2;
      const mouseX = options?.mouseX;
      const mouseXOffset =
        mouseX !== undefined ? mouseX - boundsCenterX : undefined;

      const instance: SelectionLabelInstance = {
        id: instanceId,
        selectionBounds: bounds,
        boundsMultiple: options?.boundsMultiple,
        tagName,
        componentName,
        status,
        createdAt: Date.now(),
        element: options?.element,
        elements: options?.elements,
        mouseX,
        mouseXOffsetFromCenter: mouseXOffset,
        mouseXOffsetRatio:
          mouseXOffset !== undefined && boundsHalfWidth > 0
            ? mouseXOffset / boundsHalfWidth
            : undefined,
        hideArrow: options?.hideArrow,
      };
      actions.addLabelInstance(instance);
      return instanceId;
    };

    const clearAllLabels = () => {
      cancelAllLabelFades();
      actions.clearLabelInstances();
    };

    const updateLabelAfterCopy = (
      labelInstanceId: string,
      didSucceed: boolean,
      errorMessage?: string,
    ) => {
      if (didSucceed) {
        actions.updateLabelInstance(labelInstanceId, "copied");
      } else {
        actions.updateLabelInstance(
          labelInstanceId,
          "error",
          errorMessage || "Unknown error",
        );
      }
      scheduleLabelFade(labelInstanceId);
    };

    const handleCopySuccessWithComments = (options: {
      copiedElements: Element[];
      content: string;
      extraPrompt: string | undefined;
      elementName: string | undefined;
      tagName: string | null;
      componentName: string | null;
      groupId?: string | null;
    }) => {
      const {
        copiedElements,
        content,
        extraPrompt,
        elementName,
        tagName,
        componentName,
      } = options;
      pluginRegistry.hooks.onCopySuccess(copiedElements, content);

      if (!extraPrompt) return;

      const hasCopiedElements = copiedElements.length > 0;

      if (hasCopiedElements) {
        const currentItems = commentItems();
        for (const [
          existingItemId,
          mappedElements,
        ] of commentElementMap.entries()) {
          const isSameSelection =
            mappedElements.length === copiedElements.length &&
            mappedElements.every(
              (mappedElement, index) => mappedElement === copiedElements[index],
            );
          if (!isSameSelection) continue;
          const existingItem = currentItems.find(
            (item) => item.id === existingItemId,
          );
          if (!existingItem) continue;

          if (existingItem.commentText === extraPrompt) {
            removeCommentItem(existingItemId);
            commentElementMap.delete(existingItemId);
            break;
          }
        }
      }

      const elementSelectors = copiedElements.map((copiedElement, index) =>
        createElementSelector(copiedElement, index === 0),
      );

      const itemSeed = {
        content,
        elementName: elementName ?? "element",
        tagName: tagName ?? "div",
        componentName: componentName ?? undefined,
        elementsCount: copiedElements.length,
        previewBounds: copiedElements.map((copiedElement) =>
          createElementBounds(copiedElement),
        ),
        elementSelectors,
        commentText: extraPrompt,
        timestamp: Date.now(),
        revealed: visibility.selectionsRevealed(),
        ...getPageContext(),
      };
      const groupId = selectionGroups.ensureGroupForItem(
        itemSeed,
        options.groupId,
      );
      const updatedCommentItems = addCommentItem({
        ...itemSeed,
        groupId,
      });
      setCommentItems(updatedCommentItems);
      setClockFlashTrigger((previous) => previous + 1);
      const newestCommentItem = updatedCommentItems[0];
      if (newestCommentItem && hasCopiedElements) {
        commentElementMap.set(newestCommentItem.id, [...copiedElements]);
      }

      const currentItemIds = new Set(
        updatedCommentItems.map((item) => item.id),
      );
      for (const mapItemId of commentElementMap.keys()) {
        if (!currentItemIds.has(mapItemId)) {
          commentElementMap.delete(mapItemId);
        }
      }

      // Fire-and-forget screenshot capture
      if (
        newestCommentItem &&
        pluginRegistry.store.options.screenshot?.enabled &&
        copiedElements[0]
      ) {
        captureAndUploadScreenshots(
          copiedElements[0],
          newestCommentItem.id,
          pluginRegistry.store.options.screenshot,
          getActiveAdapter(),
        ).then((screenshots) => {
          if (screenshots.screenshotElement || screenshots.screenshotFullPage) {
            const patched = patchCommentItem(newestCommentItem.id, screenshots);
            setCommentItems(patched);
          }
        });
      }
    };

    const targetElement = createMemo(() => {
      void store.viewportVersion;
      if (!isRendererActive() || isDragging()) return null;
      const element = store.detectedElement;
      if (!isElementConnected(element)) return null;
      return element;
    });

    const effectiveElement = createMemo(
      () => store.frozenElement || (isFrozenPhase() ? null : targetElement()),
    );

    createEffect(() => {
      const element = store.detectedElement;
      if (!element) return;

      const intervalId = setInterval(() => {
        if (!isElementConnected(element)) {
          actions.setDetectedElement(null);
        }
      }, BOUNDS_RECALC_INTERVAL_MS);

      onCleanup(() => clearInterval(intervalId));
    });

    createEffect(
      on(effectiveElement, (element) => {
        if (componentNameDebounceTimerId !== null) {
          clearTimeout(componentNameDebounceTimerId);
          componentNameDebounceTimerId = null;
        }

        if (!element) {
          setDebouncedElementForComponentName(null);
          return;
        }

        componentNameDebounceTimerId = window.setTimeout(() => {
          componentNameDebounceTimerId = null;
          setDebouncedElementForComponentName(element);
        }, COMPONENT_NAME_DEBOUNCE_MS);
      }),
    );

    onCleanup(() => {
      if (componentNameDebounceTimerId !== null) {
        clearTimeout(componentNameDebounceTimerId);
        componentNameDebounceTimerId = null;
      }
    });

    // HACK: In touch mode during drag, effectiveElement() is null so we use detectedElement
    const getSelectionElement = (): Element | undefined => {
      if (store.isTouchMode && isDragging()) {
        const detected = store.detectedElement;
        if (!detected || isRootElement(detected)) return undefined;
        return detected;
      }
      const element = effectiveElement();
      if (!element || isRootElement(element)) return undefined;
      return element;
    };

    const selectionElement = createMemo(() => getSelectionElement());

    const isSelectionElementVisible = (): boolean => {
      const element = selectionElement();
      if (!element) return false;
      if (store.isTouchMode && isDragging()) {
        return isRendererActive();
      }
      return isRendererActive() && !isDragging();
    };

    const frozenElementsBounds = createMemo((): OverlayBounds[] => {
      void store.viewportVersion;

      const frozenElements = store.frozenElements;
      if (frozenElements.length === 0) return [];

      const dragRect = store.frozenDragRect;
      if (dragRect && frozenElements.length > 1) {
        return [createBoundsFromDragRect(dragRect)];
      }

      return frozenElements
        .filter((element): element is Element => element !== null)
        .map((element) => createElementBounds(element));
    });

    const selectionBounds = createMemo((): OverlayBounds | undefined => {
      void store.viewportVersion;

      const frozenElements = store.frozenElements;
      if (frozenElements.length > 0) {
        const frozenBounds = frozenElementsBounds();
        if (frozenElements.length === 1) {
          const firstBounds = frozenBounds[0];
          if (firstBounds) return firstBounds;
        }
        const dragRect = store.frozenDragRect;
        if (dragRect) {
          const dragBounds = frozenBounds[0];
          return dragBounds ?? createBoundsFromDragRect(dragRect);
        }
        return createFlatOverlayBounds(combineBounds(frozenBounds));
      }

      const element = selectionElement();
      if (!element) return undefined;
      return createElementBounds(element);
    });

    const toPageCoordinates = (clientX: number, clientY: number) => ({
      pageX: clientX + window.scrollX,
      pageY: clientY + window.scrollY,
    });

    const calculateDragDistance = (endX: number, endY: number) => {
      const { pageX: endPageX, pageY: endPageY } = toPageCoordinates(
        endX,
        endY,
      );

      return {
        x: Math.abs(endPageX - store.dragStart.x),
        y: Math.abs(endPageY - store.dragStart.y),
      };
    };

    const isDraggingBeyondThreshold = createMemo(() => {
      if (!isDragging()) return false;

      const dragDistance = calculateDragDistance(
        store.pointer.x,
        store.pointer.y,
      );

      return (
        dragDistance.x > DRAG_THRESHOLD_PX || dragDistance.y > DRAG_THRESHOLD_PX
      );
    });

    const calculateDragRectangle = (endX: number, endY: number) => {
      const { pageX: endPageX, pageY: endPageY } = toPageCoordinates(
        endX,
        endY,
      );

      const dragPageX = Math.min(store.dragStart.x, endPageX);
      const dragPageY = Math.min(store.dragStart.y, endPageY);
      const dragWidth = Math.abs(endPageX - store.dragStart.x);
      const dragHeight = Math.abs(endPageY - store.dragStart.y);

      return {
        x: dragPageX - window.scrollX,
        y: dragPageY - window.scrollY,
        width: dragWidth,
        height: dragHeight,
      };
    };

    const dragBounds = createMemo((): OverlayBounds | undefined => {
      void store.viewportVersion;

      if (!isDraggingBeyondThreshold()) return undefined;

      const drag = calculateDragRectangle(store.pointer.x, store.pointer.y);

      return {
        borderRadius: "0px",
        height: drag.height,
        transform: "none",
        width: drag.width,
        x: drag.x,
        y: drag.y,
      };
    });

    const dragPreviewBounds = createMemo((): OverlayBounds[] => {
      void store.viewportVersion;

      if (!isDraggingBeyondThreshold()) return [];

      const pointer = debouncedDragPointer();
      if (!pointer) return [];

      const drag = calculateDragRectangle(pointer.x, pointer.y);
      const elements = getElementsInDrag(drag, isElementGrabbable);
      const previewElements =
        elements.length > 0
          ? elements
          : getElementsInDrag(drag, isElementGrabbable, false);

      return previewElements.map((element) => createElementBounds(element));
    });

    const selectionBoundsMultiple = createMemo((): OverlayBounds[] => {
      const previewBounds = dragPreviewBounds();
      if (previewBounds.length > 0) {
        return previewBounds;
      }
      return frozenElementsBounds();
    });

    const inspectBounds = createMemo((): OverlayBounds[] => {
      if (!isInspectMode()) return [];

      const element = effectiveElement();
      if (!element) return [];

      void store.viewportVersion;

      return [...getAncestorElements(element), element].map((ancestor) =>
        createElementBounds(ancestor),
      );
    });

    const cursorPosition = createMemo(() => {
      if (isCopying() || isPromptMode()) {
        void store.viewportVersion;
        const element = store.frozenElement || targetElement();
        if (element) {
          const { center } = getElementBoundsCenter(element);
          return {
            x: center.x + store.copyOffsetFromCenterX,
            y: store.copyStart.y,
          };
        }
        return {
          x: store.copyStart.x,
          y: store.copyStart.y,
        };
      }
      return {
        x: store.pointer.x,
        y: store.pointer.y,
      };
    });

    createEffect(
      on(
        () => [targetElement(), store.lastGrabbedElement] as const,
        ([currentElement, lastElement]) => {
          if (lastElement && currentElement && lastElement !== currentElement) {
            actions.setLastGrabbed(null);
          }
          if (currentElement) {
            pluginRegistry.hooks.onElementHover(currentElement);
          }
        },
      ),
    );

    createEffect(
      on(
        () => targetElement(),
        (element) => {
          const currentVersion = ++selectionSourceRequestVersion;

          const clearSource = () => {
            if (selectionSourceRequestVersion === currentVersion) {
              actions.setSelectionSource(null, null);
            }
          };

          if (!element) {
            clearSource();
            return;
          }

          resolveSource(element)
            .then((source) => {
              if (selectionSourceRequestVersion !== currentVersion) return;
              if (!source) {
                clearSource();
                return;
              }
              actions.setSelectionSource(source.filePath, source.lineNumber);
            })
            .catch(() => {
              if (selectionSourceRequestVersion === currentVersion) {
                actions.setSelectionSource(null, null);
              }
            });
        },
      ),
    );

    createEffect(
      on(
        () => store.viewportVersion,
        () => agentManager._internal.updateBoundsOnViewportChange(),
      ),
    );

    const publicGrabbedBoxes = createMemo(() =>
      store.grabbedBoxes.map((box) => ({
        id: box.id,
        bounds: box.bounds,
        createdAt: box.createdAt,
      })),
    );

    const publicLabelInstances = createMemo(() =>
      store.labelInstances.map((instance) => ({
        id: instance.id,
        status: instance.status,
        tagName: instance.tagName,
        componentName: instance.componentName,
        createdAt: instance.createdAt,
      })),
    );

    const derivedStateForHook = createMemo(() => {
      const active = isActivated();
      const dragging = isDragging();
      const copying = isCopying();
      const inputMode = isPromptMode();
      const target = targetElement();
      const drag = dragBounds();
      const themeEnabled = pluginRegistry.store.theme.enabled;
      const selectionBoxEnabled =
        pluginRegistry.store.theme.selectionBox.enabled;
      const dragBoxEnabled = pluginRegistry.store.theme.dragBox.enabled;
      const draggingBeyondThreshold = isDraggingBeyondThreshold();
      const effectiveTarget = effectiveElement();
      const justCopied = didJustCopy();

      const isSelectionBoxVisible = Boolean(
        themeEnabled &&
        selectionBoxEnabled &&
        active &&
        !copying &&
        !justCopied &&
        !dragging &&
        effectiveTarget != null,
      );
      const isDragBoxVisible = Boolean(
        themeEnabled &&
        dragBoxEnabled &&
        active &&
        !copying &&
        draggingBeyondThreshold,
      );

      return {
        isActive: active,
        isDragging: dragging,
        isCopying: copying,
        isPromptMode: inputMode,
        isSelectionBoxVisible,
        isDragBoxVisible,
        targetElement: target,
        dragBounds: drag
          ? { x: drag.x, y: drag.y, width: drag.width, height: drag.height }
          : null,
        grabbedBoxes: [...publicGrabbedBoxes()],
        labelInstances: [...publicLabelInstances()],
        selectionFilePath: store.selectionFilePath,
        toolbarState: currentToolbarState(),
      };
    });

    createEffect(
      on(derivedStateForHook, (state) => {
        pluginRegistry.hooks.onStateChange(state);
      }),
    );

    createEffect(
      on(
        () =>
          [
            isPromptMode(),
            store.pointer.x,
            store.pointer.y,
            targetElement(),
          ] as const,
        ([inputMode, x, y, target]) => {
          pluginRegistry.hooks.onPromptModeChange(inputMode, {
            x,
            y,
            targetElement: target,
          });
        },
      ),
    );

    createEffect(
      on(
        () => [selectionVisible(), selectionBounds(), targetElement()] as const,
        ([visible, bounds, element]) => {
          pluginRegistry.hooks.onSelectionBox(
            Boolean(visible),
            bounds ?? null,
            element,
          );
        },
      ),
    );

    createEffect(
      on(
        () => [dragVisible(), dragBounds()] as const,
        ([visible, bounds]) => {
          pluginRegistry.hooks.onDragBox(Boolean(visible), bounds ?? null);
        },
      ),
    );

    createEffect(
      on(
        () =>
          [
            labelVisible(),
            labelVariant(),
            cursorPosition(),
            targetElement(),
            store.selectionFilePath,
            store.selectionLineNumber,
          ] as const,
        ([visible, variant, position, element, filePath, lineNumber]) => {
          pluginRegistry.hooks.onElementLabel(Boolean(visible), variant, {
            x: position.x,
            y: position.y,
            content: "",
            element: element ?? undefined,
            tagName: element ? getTagName(element) || undefined : undefined,
            filePath: filePath ?? undefined,
            lineNumber: lineNumber ?? undefined,
          });
        },
      ),
    );

    let cursorStyleElement: HTMLStyleElement | null = null;

    const setCursorOverride = (cursor: string | null) => {
      if (cursor) {
        if (!cursorStyleElement) {
          cursorStyleElement = document.createElement("style");
          cursorStyleElement.setAttribute("data-react-grab-cursor", "");
          document.head.appendChild(cursorStyleElement);
        }
        cursorStyleElement.textContent = `* { cursor: ${cursor} !important; }`;
      } else if (cursorStyleElement) {
        cursorStyleElement.remove();
        cursorStyleElement = null;
      }
    };

    createEffect(
      on(
        () => [isActivated(), isCopying(), isPromptMode()] as const,
        ([activated, copying, promptMode]) => {
          if (copying) {
            setCursorOverride("progress");
          } else if (activated && !promptMode) {
            setCursorOverride("crosshair");
          } else {
            setCursorOverride(null);
          }
        },
      ),
    );

    const activateRenderer = () => {
      if (store.pendingCommentMode) engine?.comment();
      else engine?.activate();
    };

    const deactivateRenderer = () => {
      pendingSubmission = undefined;
      engine?.reset();
      actions.deactivate();
      setIsInspectMode(false);
      clearArrowNavigation();
      isPendingContextMenuSelect = false;
      if (keydownSpamTimerId) window.clearTimeout(keydownSpamTimerId);
      autoScroller.stop();
    };

    const toggleActivate = () => {
      actions.setWasActivatedByToggle(true);
      activateRenderer();
    };

    const restoreInputFromSession = (
      session: AgentSession,
      elements: Element[],
      agent?: AgentOptions,
    ) => {
      const element = elements[0];
      if (isElementConnected(element)) {
        const rect = element.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;

        actions.setPointer({ x: session.position.x, y: centerY });
        actions.setFrozenElements(elements);
        actions.setInputText(session.context.prompt);
        actions.setWasActivatedByToggle(true);

        if (agent) {
          actions.setSelectedAgent(agent);
        }

        if (!isActivated()) {
          activateRenderer();
        }
      }
    };

    const wrapAgentWithCallbacks = (agent: AgentOptions): AgentOptions => {
      return {
        ...agent,
        onAbort: (session: AgentSession, elements: Element[]) => {
          agent.onAbort?.(session, elements);
          restoreInputFromSession(session, elements, agent);
        },
        onUndo: (session: AgentSession, elements: Element[]) => {
          agent.onUndo?.(session, elements);
          restoreInputFromSession(session, elements, agent);
        },
      };
    };

    const getAgentOptionsWithCallbacks = () => {
      const agent = getAgentFromActions();
      if (!agent) return undefined;
      return wrapAgentWithCallbacks(agent);
    };

    const agentManager = createAgentManager(getAgentOptionsWithCallbacks(), {
      transformAgentContext: pluginRegistry.hooks.transformAgentContext,
    });

    const handleInputSubmit = async () => {
      if (pendingSubmission || !engine) return;
      actions.clearLastCopied();
      const frozenElements = [...store.frozenElements];
      const element = store.frozenElement || targetElement();
      const prompt = isPromptMode() ? store.inputText.trim() : "";

      if (!element) {
        deactivateRenderer();
        return;
      }

      const elements = frozenElements.length > 0 ? frozenElements : [element];

      const currentSelectionBounds = elements.map((selectedElement) =>
        createElementBounds(selectedElement),
      );
      const firstBounds = currentSelectionBounds[0];
      const { x: currentX, y: currentY } = getBoundsCenter(firstBounds);
      const labelPositionX = currentX + store.copyOffsetFromCenterX;

      if ((store.selectedAgent || store.hasAgentProvider) && prompt) {
        const currentReplySessionId = store.replySessionId;
        const selectedAgent = store.selectedAgent;

        deactivateRenderer();

        actions.clearReplySessionId();
        actions.setSelectedAgent(null);

        void agentManager.session.start({
          elements,
          prompt,
          position: { x: labelPositionX, y: currentY },
          selectionBounds: currentSelectionBounds,
          sessionId: currentReplySessionId ?? undefined,
          agent: selectedAgent
            ? wrapAgentWithCallbacks(selectedAgent)
            : undefined,
        });

        return;
      }

      const submission: PendingSubmission = {
        elements,
        prompt,
        groupId: selectionGroups.activeGroupId(),
        position: { x: currentX, y: currentY },
      };
      pendingSubmission = submission;
      try {
        const success = await engine.copyElement(elements);
        if (disposed || pendingSubmission !== submission) return;
        if (success) deactivateRenderer();
        else {
          actions.setFrozenElements(elements);
          actions.enterPromptMode(submission.position, element);
          actions.setInputText(prompt);
        }
      } finally {
        if (pendingSubmission === submission) pendingSubmission = undefined;
      }
    };

    const handleInputCancel = () => {
      actions.clearLastCopied();
      if (!isPromptMode()) return;

      if (isPendingDismiss()) {
        actions.clearInputText();
        actions.clearReplySessionId();
        deactivateRenderer();
        return;
      }

      actions.setPendingDismiss(true);
      setSelectionLabelShakeCount((count) => count + 1);
    };

    const handleConfirmDismiss = () => {
      actions.clearInputText();
      actions.clearReplySessionId();
      deactivateRenderer();
    };

    const handleCancelDismiss = () => {
      actions.setPendingDismiss(false);
    };

    const handleAgentAbort = (sessionId: string, confirmed: boolean) => {
      actions.setPendingAbortSessionId(null);
      if (confirmed) {
        agentManager.session.abort(sessionId);
      }
    };

    const handleToggleExpand = () => {
      const element = store.frozenElement || targetElement();
      if (element) {
        preparePromptMode(element, store.pointer.x, store.pointer.y);
      }
      activatePromptMode();
    };

    const handleFollowUpSubmit = (sessionId: string, prompt: string) => {
      const session = agentManager.sessions().get(sessionId);
      const elements = agentManager.session.getElements(sessionId);
      const sessionBounds = session?.selectionBounds ?? [];
      const firstBounds = sessionBounds[0];
      if (session && elements.length > 0 && firstBounds) {
        const positionX = session.position.x;
        const followUpSessionId = session.context.sessionId ?? sessionId;

        agentManager.session.dismiss(sessionId);

        void agentManager.session.start({
          elements,
          prompt,
          position: {
            x: positionX,
            y: firstBounds.y + firstBounds.height / 2,
          },
          selectionBounds: sessionBounds,
          sessionId: followUpSessionId,
        });
      }
    };

    const handleAcknowledgeError = (sessionId: string) => {
      const prompt = agentManager.session.acknowledgeError(sessionId);
      if (prompt) {
        actions.setInputText(prompt);
      }
    };

    const handleToggleActive = () => {
      if (isActivated()) {
        deactivateRenderer();
      } else if (isEnabled()) {
        const defaultActionId =
          currentToolbarState()?.defaultAction ?? DEFAULT_ACTION_ID;
        if (defaultActionId === DEFAULT_ACTION_ID) {
          actions.setPendingCommentMode(true);
        } else {
          pendingDefaultActionId = defaultActionId;
          isPendingContextMenuSelect = true;
        }
        toggleActivate();
      }
    };

    const enterCommentModeForElement = (
      element: Element,
      positionX: number,
      positionY: number,
    ) => {
      actions.setPendingCommentMode(false);
      actions.clearInputText();
      actions.enterPromptMode({ x: positionX, y: positionY }, element);
    };

    const openContextMenu = (element: Element, position: Position) => {
      actions.showContextMenu(position, element);
      clearArrowNavigation();
      dismissAllPopups();
      pluginRegistry.hooks.onContextMenu(element, position);
    };

    const runPendingDefaultAction = (element: Element, position: Position) => {
      const actionId = pendingDefaultActionId;
      pendingDefaultActionId = null;
      if (!actionId) return;

      const action = pluginRegistry.store.actions.find(
        (registeredAction) => registeredAction.id === actionId,
      );
      if (!action) {
        handleSetDefaultAction(DEFAULT_ACTION_ID);
        openContextMenu(element, position);
        return;
      }

      const elementBounds = createElementBounds(element);
      const context = buildActionContext({
        element,
        filePath: store.selectionFilePath ?? undefined,
        lineNumber: store.selectionLineNumber ?? undefined,
        tagName: getTagName(element) || undefined,
        componentName: resolvedComponentName(),
        position,
        shouldDeferHideContextMenu: false,
        performWithFeedbackOptions: {
          fallbackBounds: elementBounds,
          fallbackSelectionBounds: [elementBounds],
          position,
        },
      });
      action.onAction(context);
    };

    const handleComment = () => {
      if (!isEnabled()) return;

      const isAlreadyInCommentMode = isActivated() && isCommentMode();
      if (isAlreadyInCommentMode) {
        deactivateRenderer();
        return;
      }

      actions.setPendingCommentMode(true);
      if (!isActivated()) {
        toggleActivate();
      }
    };

    const handleToggleEnabled = () => {
      // Kept for toolbar enabled prop (always true) — no-op
    };

    const handleToggleDevMode = () => {
      const newDevMode = !isDevMode();
      setIsDevMode(newDevMode);
      updateToolbarState({ devMode: newDevMode });
    };

    const eventListenerManager = createEventListenerManager();
    eventListenerManager.addWindowListener(
      "pointerdown",
      (event: PointerEvent) => {
        if (!event.isPrimary || event.button !== 0 || !isPromptMode()) return;
        if (isEventFromOverlay(event, "data-react-grab-ignore-events")) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const bounds = selectionBounds();
        const isInsideSelection =
          bounds &&
          event.clientX >= bounds.x &&
          event.clientX <= bounds.x + bounds.width &&
          event.clientY >= bounds.y &&
          event.clientY <= bounds.y + bounds.height;
        if (isInsideSelection) void handleInputSubmit();
        else handleInputCancel();
      },
      { capture: true },
    );

    eventListenerManager.addWindowListener(
      "pointermove",
      (event: PointerEvent) => {
        if (!event.isPrimary || isPromptMode() || store.contextMenuPosition)
          return;
        if (isEventFromOverlay(event, "data-react-grab-ignore-events")) return;
        actions.setPointer({ x: event.clientX, y: event.clientY });
        if (isDragging())
          scheduleDragPreviewUpdate(event.clientX, event.clientY);
      },
      { passive: true },
    );
    eventListenerManager.addWindowListener(
      "keydown",
      (event: KeyboardEvent) => {
        if (!isKeyboardEventTriggeredByInput(event)) handleUndoRedoKeys(event);
      },
    );

    const handleUndoRedoKeys = (event: KeyboardEvent): boolean => {
      const isUndoOrRedo =
        event.code === "KeyZ" && (event.metaKey || event.ctrlKey);

      if (!isUndoOrRedo) return false;

      const hasActiveConfirmation = Array.from(
        agentManager.sessions().values(),
      ).some((session) => !session.isStreaming && !session.error);

      if (hasActiveConfirmation) return false;

      const isRedo = event.shiftKey;

      if (isRedo && agentManager.canRedo()) {
        event.preventDefault();
        event.stopPropagation();
        agentManager.history.redo();
        return true;
      } else if (!isRedo && agentManager.canUndo()) {
        event.preventDefault();
        event.stopPropagation();
        agentManager.history.undo();
        return true;
      }

      return false;
    };

    const clearArrowNavigation = () => {
      setArrowNavigationElements([]);
      setArrowNavigationActiveIndex(0);
    };

    const openArrowNavigationMenu = (anchorElement: Element) => {
      const probePoint = getVisibleBoundsCenter(
        createElementBounds(anchorElement),
      );
      const elements = getElementsAtPoint(probePoint.x, probePoint.y, {
        filter: isElementGrabbable,
      }).reverse();
      setArrowNavigationElements(elements);
      setArrowNavigationActiveIndex(
        Math.max(0, elements.indexOf(anchorElement)),
      );
    };

    const handleArrowNavigationSelect = (index: number) => {
      const targetElement = arrowNavigationElements()[index];
      if (!targetElement) return;

      setArrowNavigationActiveIndex(index);
      engine?.selectElement(targetElement);
    };

    const clearActionCycleIdleTimeout = () => {
      if (actionCycleIdleTimeoutId !== null) {
        window.clearTimeout(actionCycleIdleTimeoutId);
        actionCycleIdleTimeoutId = null;
      }
    };

    const resetActionCycle = () => {
      clearActionCycleIdleTimeout();
      setActionCycleItems([]);
      setActionCycleActiveIndex(null);
    };

    const canCycleActions = createMemo(() => {
      const element = selectionElement();
      return (
        Boolean(element) &&
        isRendererActive() &&
        !isPromptMode() &&
        !isDragging() &&
        store.contextMenuPosition === null
      );
    });

    const activationBaseKey = createMemo(() => {
      const { key } = getModifiersFromActivationKey(
        pluginRegistry.store.options.activationKey,
      );
      return (key ?? "c").toUpperCase();
    });

    const actionCycleState = createMemo<ActionCycleState>(() => ({
      items: actionCycleItems(),
      activeIndex: actionCycleActiveIndex(),
      isVisible:
        actionCycleActiveIndex() !== null &&
        actionCycleItems().length > 0 &&
        !isCommentMode(),
    }));

    const arrowNavigationItems = createMemo(() =>
      arrowNavigationElements().map((element) => ({
        tagName: getTagName(element) || "element",
        componentName: getComponentDisplayName(element) ?? undefined,
      })),
    );

    const arrowNavigationState = createMemo<ArrowNavigationState>(() => ({
      items: arrowNavigationItems(),
      activeIndex: arrowNavigationActiveIndex(),
      isVisible: arrowNavigationElements().length > 0,
    }));

    const inspectAncestorElements = createMemo((): Element[] => {
      if (!isInspectMode()) return [];
      const element = effectiveElement();
      if (!element) return [];
      return [...getAncestorElements(element).reverse(), element];
    });

    const inspectNavigationItems = createMemo(() =>
      inspectAncestorElements().map((element) => ({
        tagName: getTagName(element) || "element",
        componentName: getComponentDisplayName(element) ?? undefined,
      })),
    );

    const [inspectActiveIndex, setInspectActiveIndex] = createSignal(-1);

    createEffect(
      on(inspectAncestorElements, (elements) => {
        setInspectActiveIndex(elements.length - 1);
      }),
    );

    const inspectNavigationState = createMemo<ArrowNavigationState>(() => {
      const elements = inspectAncestorElements();
      return {
        items: inspectNavigationItems(),
        activeIndex: inspectActiveIndex(),
        isVisible: isInspectMode() && elements.length > 0,
      };
    });

    const handleInspectSelect = (index: number) => {
      setInspectActiveIndex(index);
    };

    createEffect(
      on(selectionElement, () => {
        resetActionCycle();
      }),
    );

    createEffect(
      on(canCycleActions, (isEnabled) => {
        if (!isEnabled) {
          resetActionCycle();
        }
      }),
    );

    const getActionById = (actionId: string): ContextMenuAction | undefined =>
      pluginRegistry.store.actions.find((action) => action.id === actionId);

    const getActionCycleContext = (): ContextMenuActionContext | undefined => {
      const element = selectionElement();
      if (!element) return undefined;

      const fallbackBounds = selectionBounds();

      return buildActionContext({
        element,
        filePath: store.selectionFilePath ?? undefined,
        lineNumber: store.selectionLineNumber ?? undefined,
        tagName: getTagName(element) || undefined,
        componentName: resolvedComponentName(),
        position: store.pointer,
        performWithFeedbackOptions: {
          fallbackBounds,
          fallbackSelectionBounds: fallbackBounds ? [fallbackBounds] : [],
        },
        shouldDeferHideContextMenu: false,
        onBeforePrompt: resetActionCycle,
      });
    };

    const availableActionCycleItems = createMemo((): ActionCycleItem[] => {
      if (!selectionElement()) return [];

      const cycleItems: ActionCycleItem[] = [];
      for (const action of pluginRegistry.store.actions) {
        const isStaticallyDisabled =
          typeof action.enabled === "boolean" && !action.enabled;
        if (isStaticallyDisabled) continue;
        const hasNonMatchingShortcut =
          action.shortcut &&
          action.shortcut.toUpperCase() !== activationBaseKey();
        if (hasNonMatchingShortcut) continue;
        cycleItems.push({
          id: action.id,
          label: action.label,
          shortcut: action.shortcut,
        });
      }
      return cycleItems;
    });

    const scheduleActionCycleActivation = () => {
      clearActionCycleIdleTimeout();
      actionCycleIdleTimeoutId = window.setTimeout(() => {
        actionCycleIdleTimeoutId = null;
        const activeIndex = actionCycleActiveIndex();
        const items = actionCycleItems();
        if (activeIndex === null || items.length === 0) return;
        const selectedItem = items[activeIndex];
        if (!selectedItem) return;
        const action = getActionById(selectedItem.id);
        if (!action) {
          resetActionCycle();
          return;
        }
        const context = getActionCycleContext();
        if (!context || !resolveActionEnabled(action, context)) {
          resetActionCycle();
          return;
        }
        resetActionCycle();
        const result = action.onAction(context);
        if (result instanceof Promise) {
          void result;
        }
      }, ACTION_CYCLE_IDLE_TRIGGER_MS);
    };

    const advanceActionCycle = (): boolean => {
      if (!canCycleActions()) return false;
      const cycleItems = availableActionCycleItems();
      if (cycleItems.length === 0) return false;

      setActionCycleItems(cycleItems);

      const currentIndex = actionCycleActiveIndex();
      const isCurrentIndexValid =
        currentIndex !== null && currentIndex < cycleItems.length;
      const nextIndex = isCurrentIndexValid
        ? (currentIndex + 1) % cycleItems.length
        : 0;

      setActionCycleActiveIndex(nextIndex);
      scheduleActionCycleActivation();
      return true;
    };

    const handleActionCycleKey = (event: KeyboardEvent): boolean => {
      if (!keyMatchesCode(activationBaseKey(), event.code)) return false;
      if (event.altKey || event.repeat) return false;
      if (isKeyboardEventTriggeredByInput(event)) return false;
      if (!advanceActionCycle()) return false;

      event.preventDefault();
      event.stopImmediatePropagation();
      return true;
    };

    eventListenerManager.addWindowListener(
      "keydown",
      (event: KeyboardEvent) => {
        if (handleActionCycleKey(event)) return;
        if (
          !isActivated() ||
          isPromptMode() ||
          isKeyboardEventTriggeredByInput(event)
        )
          return;
        if (event.key === "Shift") {
          setIsInspectMode(true);
          clearArrowNavigation();
        } else if (event.key.startsWith("Arrow") || event.key === "Tab") {
          const element = selectionElement();
          if (element) openArrowNavigationMenu(element);
        }
      },
      { capture: true },
    );
    eventListenerManager.addWindowListener(
      "keyup",
      (event: KeyboardEvent) => {
        if (event.key === "Shift") setIsInspectMode(false);
      },
      { capture: true },
    );

    eventListenerManager.addWindowListener(
      "focusin",
      (event: FocusEvent) => {
        if (isEventFromOverlay(event, "data-react-grab-ignore-events")) {
          event.stopPropagation();
        }
      },
      { capture: true },
    );

    const handleViewportChange = () => {
      invalidateBoundsCache();
      actions.incrementViewportVersion();
      agentManager._internal.updateBoundsOnViewportChange();
      actions.updateContextMenuPosition();
    };

    eventListenerManager.addWindowListener("scroll", handleViewportChange, {
      capture: true,
    });

    let previousViewportWidth = window.innerWidth;
    let previousViewportHeight = window.innerHeight;

    eventListenerManager.addWindowListener("resize", () => {
      const currentViewportWidth = window.innerWidth;
      const currentViewportHeight = window.innerHeight;

      if (previousViewportWidth > 0 && previousViewportHeight > 0) {
        const scaleX = currentViewportWidth / previousViewportWidth;
        const scaleY = currentViewportHeight / previousViewportHeight;
        const isUniformScale =
          Math.abs(scaleX - scaleY) < ZOOM_DETECTION_THRESHOLD;
        const hasScaleChanged = Math.abs(scaleX - 1) > ZOOM_DETECTION_THRESHOLD;

        if (isUniformScale && hasScaleChanged) {
          actions.setPointer({
            x: store.pointer.x * scaleX,
            y: store.pointer.y * scaleY,
          });
        }
      }

      previousViewportWidth = currentViewportWidth;
      previousViewportHeight = currentViewportHeight;

      handleViewportChange();
    });

    const visualViewport = window.visualViewport;
    if (visualViewport) {
      const { signal } = eventListenerManager;
      visualViewport.addEventListener("resize", handleViewportChange, {
        signal,
      });
      visualViewport.addEventListener("scroll", handleViewportChange, {
        signal,
      });
    }

    let boundsRecalcIntervalId: number | null = null;
    let viewportChangeFrameId: number | null = null;

    const scheduleBoundsSync = () => {
      if (viewportChangeFrameId !== null) return;

      viewportChangeFrameId = nativeRequestAnimationFrame(() => {
        viewportChangeFrameId = null;
        actions.incrementViewportVersion();
        agentManager._internal.updateBoundsOnViewportChange();
      });
    };

    createEffect(() => {
      const shouldRunInterval =
        pluginRegistry.store.theme.enabled &&
        (isActivated() ||
          isCopying() ||
          store.labelInstances.length > 0 ||
          store.grabbedBoxes.length > 0 ||
          agentManager.sessions().size > 0);

      if (shouldRunInterval) {
        if (boundsRecalcIntervalId !== null) return;

        boundsRecalcIntervalId = window.setInterval(() => {
          scheduleBoundsSync();
        }, BOUNDS_RECALC_INTERVAL_MS);
        return;
      }

      if (boundsRecalcIntervalId !== null) {
        window.clearInterval(boundsRecalcIntervalId);
        boundsRecalcIntervalId = null;
      }

      if (viewportChangeFrameId !== null) {
        nativeCancelAnimationFrame(viewportChangeFrameId);
        viewportChangeFrameId = null;
      }
    });

    onCleanup(() => {
      if (boundsRecalcIntervalId !== null) {
        window.clearInterval(boundsRecalcIntervalId);
      }
      if (viewportChangeFrameId !== null) {
        nativeCancelAnimationFrame(viewportChangeFrameId);
      }
    });

    onCleanup(() => {
      eventListenerManager.abort();
      if (dragPreviewDebounceTimerId !== null) {
        window.clearTimeout(dragPreviewDebounceTimerId);
      }
      if (keydownSpamTimerId) window.clearTimeout(keydownSpamTimerId);
      if (actionCycleIdleTimeoutId) {
        window.clearTimeout(actionCycleIdleTimeoutId);
      }
      if (dropdownTrackingFrameId !== null) {
        nativeCancelAnimationFrame(dropdownTrackingFrameId);
      }
      grabbedBoxTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      grabbedBoxTimeouts.clear();
      cancelAllLabelFades();
      autoScroller.stop();
      document.body.style.userSelect = "";
      document.body.style.touchAction = "";
      setCursorOverride(null);
    });

    const resolvedCssText = typeof cssText === "string" ? cssText : "";
    const { root: rendererRoot } = mountRoot(resolvedCssText);

    const isThemeEnabled = createMemo(() => pluginRegistry.store.theme.enabled);
    const isSelectionBoxThemeEnabled = createMemo(
      () => pluginRegistry.store.theme.selectionBox.enabled,
    );
    const isElementLabelThemeEnabled = createMemo(
      () => pluginRegistry.store.theme.elementLabel.enabled,
    );
    const isDragBoxThemeEnabled = createMemo(
      () => pluginRegistry.store.theme.dragBox.enabled,
    );
    const isSelectionSuppressed = createMemo(
      () => didJustCopy() || (isToolbarSelectHovered() && !isFrozenPhase()),
    );
    const hasDragPreviewBounds = createMemo(
      () => dragPreviewBounds().length > 0,
    );

    const selectionVisible = createMemo(() => {
      if (!isThemeEnabled()) return false;
      if (!isSelectionBoxThemeEnabled()) return false;
      if (isSelectionSuppressed()) return false;
      if (hasDragPreviewBounds()) return true;
      return isSelectionElementVisible();
    });

    const selectionTagName = createMemo(() => {
      const element = selectionElement();
      if (!element) return undefined;
      return getTagName(element) || undefined;
    });

    createEffect(
      on(
        () => debouncedElementForComponentName(),
        (element) => {
          const currentVersion = ++componentNameRequestVersion;

          if (!element) {
            setResolvedComponentName(undefined);
            return;
          }

          getNearestComponentName(element)
            .then((name) => {
              if (componentNameRequestVersion !== currentVersion) return;
              setResolvedComponentName(name ?? undefined);
            })
            .catch(() => {
              if (componentNameRequestVersion !== currentVersion) return;
              setResolvedComponentName(undefined);
            });
        },
      ),
    );

    const selectionLabelVisible = createMemo(() => {
      if (store.contextMenuPosition !== null) return false;
      if (!isElementLabelThemeEnabled()) return false;
      if (isSelectionSuppressed()) return false;

      return isSelectionElementVisible();
    });

    const labelInstanceCache = new Map<string, SelectionLabelInstance>();

    const recomputeLabelInstance = (
      instance: SelectionLabelInstance,
    ): SelectionLabelInstance => {
      const hasMultipleElements =
        instance.elements && instance.elements.length > 1;
      const instanceElement = instance.element;
      const canRecalculateBounds =
        !hasMultipleElements &&
        instanceElement &&
        document.body.contains(instanceElement);
      const newBounds = canRecalculateBounds
        ? createElementBounds(instanceElement)
        : instance.selectionBounds;

      const previousInstance = labelInstanceCache.get(instance.id);
      const boundsUnchanged =
        previousInstance &&
        previousInstance.selectionBounds.x === newBounds.x &&
        previousInstance.selectionBounds.y === newBounds.y &&
        previousInstance.selectionBounds.width === newBounds.width &&
        previousInstance.selectionBounds.height === newBounds.height;
      if (
        previousInstance &&
        previousInstance.status === instance.status &&
        previousInstance.error === instance.error &&
        boundsUnchanged
      ) {
        return previousInstance;
      }
      const newBoundsCenterX = newBounds.x + newBounds.width / 2;
      const newBoundsHalfWidth = newBounds.width / 2;
      let newMouseX: number;
      if (instance.mouseXOffsetRatio !== undefined && newBoundsHalfWidth > 0) {
        newMouseX =
          newBoundsCenterX + instance.mouseXOffsetRatio * newBoundsHalfWidth;
      } else if (instance.mouseXOffsetFromCenter !== undefined) {
        newMouseX = newBoundsCenterX + instance.mouseXOffsetFromCenter;
      } else {
        newMouseX = instance.mouseX ?? newBoundsCenterX;
      }
      const newCached = {
        ...instance,
        selectionBounds: newBounds,
        mouseX: newMouseX,
      };
      labelInstanceCache.set(instance.id, newCached);
      return newCached;
    };

    const computedLabelInstances = createMemo(() => {
      if (!isThemeEnabled()) return [];
      if (!pluginRegistry.store.theme.grabbedBoxes.enabled) return [];
      void store.viewportVersion;
      const currentIds = new Set(
        store.labelInstances.map((instance) => instance.id),
      );
      for (const cachedId of labelInstanceCache.keys()) {
        if (!currentIds.has(cachedId)) {
          labelInstanceCache.delete(cachedId);
        }
      }
      return store.labelInstances.map(recomputeLabelInstance);
    });

    const computedGrabbedBoxes = createMemo(() => {
      if (!isThemeEnabled()) return [];
      if (!pluginRegistry.store.theme.grabbedBoxes.enabled) return [];
      void store.viewportVersion;
      return store.grabbedBoxes.map((box) => {
        if (!box.element || !document.body.contains(box.element)) {
          return box;
        }
        return {
          ...box,
          bounds: createElementBounds(box.element),
        };
      });
    });

    const dragVisible = createMemo(
      () =>
        isThemeEnabled() &&
        isDragBoxThemeEnabled() &&
        isRendererActive() &&
        isDraggingBeyondThreshold(),
    );

    const labelVariant = createMemo(() =>
      isCopying() ? "processing" : "hover",
    );

    const labelVisible = createMemo(() => {
      if (!isThemeEnabled()) return false;
      const themeEnabled = isElementLabelThemeEnabled();
      const inPromptMode = isPromptMode();
      const copying = isCopying();
      const rendererActive = isRendererActive();
      const dragging = isDragging();
      const hasElement = Boolean(effectiveElement());
      const toolbarSelectHovered = isToolbarSelectHovered();
      const frozen = isFrozenPhase();

      if (!themeEnabled) return false;
      if (inPromptMode) return false;
      if (toolbarSelectHovered && !frozen) return false;
      if (copying) return true;
      return rendererActive && !dragging && hasElement;
    });

    const contextMenuBounds = createMemo((): OverlayBounds | null => {
      void store.viewportVersion;
      const element = store.contextMenuElement;
      if (!element) return null;
      return createElementBounds(element);
    });

    const contextMenuPosition = createMemo(() => {
      void store.viewportVersion;
      return store.contextMenuPosition;
    });

    const contextMenuTagName = createMemo(() => {
      const element = store.contextMenuElement;
      if (!element) return undefined;
      const frozenCount = store.frozenElements.length;
      if (frozenCount > 1) {
        return `${frozenCount} elements`;
      }
      return getTagName(element) || undefined;
    });

    const [contextMenuComponentName] = createResource(
      () => ({
        element: store.contextMenuElement,
        frozenCount: store.frozenElements.length,
      }),
      async ({ element, frozenCount }) => {
        if (!element) return undefined;
        if (frozenCount > 1) return undefined;
        const name = await getNearestComponentName(element);
        return name ?? undefined;
      },
    );

    const [contextMenuFilePath] = createResource(
      () => store.contextMenuElement,
      async (element) => {
        if (!element) return null;
        return resolveSource(element);
      },
    );

    const createPerformWithFeedback = (
      element: Element,
      elements: Element[],
      tagName: string | undefined,
      componentName: string | undefined,
      options?: PerformWithFeedbackOptions,
    ) => {
      return async (action: () => Promise<boolean>): Promise<void> => {
        const fallbackBounds = options?.fallbackBounds ?? null;
        const fallbackSelectionBounds = options?.fallbackSelectionBounds ?? [];
        const position =
          options?.position ?? store.contextMenuPosition ?? store.pointer;
        const frozenBounds = frozenElementsBounds();
        const singleElementBounds = contextMenuBounds() ?? fallbackBounds;
        const hasMultipleElements = elements.length > 1;

        const labelBounds = hasMultipleElements
          ? createFlatOverlayBounds(combineBounds(frozenBounds))
          : singleElementBounds;

        const shouldDeactivateAfter = store.wasActivatedByToggle;
        let selectionBoundsForLabel: OverlayBounds[];
        if (hasMultipleElements) {
          selectionBoundsForLabel = frozenBounds;
        } else if (singleElementBounds) {
          selectionBoundsForLabel = [singleElementBounds];
        } else {
          selectionBoundsForLabel = fallbackSelectionBounds;
        }

        actions.hideContextMenu();

        if (labelBounds) {
          const labelCursorX = hasMultipleElements
            ? labelBounds.x + labelBounds.width / 2
            : position.x;

          const labelInstanceId = createLabelInstance(
            labelBounds,
            tagName || "element",
            componentName,
            "copying",
            {
              element,
              mouseX: labelCursorX,
              elements: hasMultipleElements ? elements : undefined,
              boundsMultiple: selectionBoundsForLabel,
            },
          );

          let didSucceed = false;
          let errorMessage: string | undefined;

          try {
            didSucceed = await action();
            if (!didSucceed) {
              errorMessage = "Failed to copy";
            }
          } catch (error) {
            errorMessage = normalizeErrorMessage(error, "Action failed");
          }

          updateLabelAfterCopy(labelInstanceId, didSucceed, errorMessage);
        } else {
          // HACK: Fire-and-forget when no label bounds to display feedback on
          try {
            await action();
          } catch (error) {
            logRecoverableError("Action failed without feedback bounds", error);
          }
        }

        if (shouldDeactivateAfter) {
          deactivateRenderer();
        } else {
          actions.unfreeze();
        }
      };
    };

    // HACK: Defer hiding context menu until after click event propagates fully
    const deferHideContextMenu = () => {
      setTimeout(() => {
        actions.hideContextMenu();
      }, 0);
    };

    const buildActionContext = (
      options: BuildActionContextOptions,
    ): ContextMenuActionContext => {
      const {
        element,
        filePath,
        lineNumber,
        tagName,
        componentName,
        position,
        performWithFeedbackOptions,
        shouldDeferHideContextMenu,
        onBeforeCopy,
        onBeforePrompt,
        customEnterPromptMode,
      } = options;

      const elements =
        store.frozenElements.length > 0 ? store.frozenElements : [element];

      const hideContextMenuAction = shouldDeferHideContextMenu
        ? deferHideContextMenu
        : actions.hideContextMenu;

      const copyAction = () => {
        onBeforeCopy?.();
        const shouldDeactivateAfter = store.wasActivatedByToggle;
        void engine?.copyElement(elements).then((success) => {
          if (success && shouldDeactivateAfter && !disposed)
            deactivateRenderer();
        });
        hideContextMenuAction();
      };

      const defaultEnterPromptMode = (agent?: AgentOptions) => {
        if (agent) {
          actions.setSelectedAgent(agent);
        }
        clearAllLabels();
        onBeforePrompt?.();
        preparePromptMode(element, position.x, position.y);
        actions.setPointer({ x: position.x, y: position.y });
        actions.setFrozenElement(element);
        activatePromptMode();
        if (!isActivated()) {
          activateRenderer();
        }
        hideContextMenuAction();
      };

      const context: ContextMenuActionContext = {
        element,
        elements,
        filePath,
        lineNumber,
        componentName,
        tagName,
        enterPromptMode: customEnterPromptMode ?? defaultEnterPromptMode,
        copy: copyAction,
        hooks: {
          transformHtmlContent: pluginRegistry.hooks.transformHtmlContent,
          onOpenFile: pluginRegistry.hooks.onOpenFile,
          transformOpenFileUrl: pluginRegistry.hooks.transformOpenFileUrl,
        },
        performWithFeedback: createPerformWithFeedback(
          element,
          elements,
          tagName,
          componentName,
          performWithFeedbackOptions,
        ),
        hideContextMenu: hideContextMenuAction,
        cleanup: () => {
          if (store.wasActivatedByToggle) {
            deactivateRenderer();
          } else {
            actions.unfreeze();
          }
        },
      };

      const transformedContext =
        pluginRegistry.hooks.transformActionContext(context);
      return { ...context, ...transformedContext };
    };

    const contextMenuActionContext = createMemo(
      (): ContextMenuActionContext | undefined => {
        const element = store.contextMenuElement;
        if (!element) return undefined;
        const fileInfo = contextMenuFilePath();
        const position = store.contextMenuPosition ?? store.pointer;

        return buildActionContext({
          element,
          filePath: fileInfo?.filePath,
          lineNumber: fileInfo?.lineNumber ?? undefined,
          tagName: contextMenuTagName(),
          componentName: contextMenuComponentName(),
          position,
          shouldDeferHideContextMenu: true,
          onBeforeCopy: () => {},
          customEnterPromptMode: (agent?: AgentOptions) => {
            if (agent) {
              actions.setSelectedAgent(agent);
            }
            clearAllLabels();
            actions.clearInputText();
            actions.enterPromptMode(position, element);
            deferHideContextMenu();
          },
        });
      },
    );

    const handleContextMenuDismiss = () => {
      setTimeout(() => {
        actions.hideContextMenu();
        deactivateRenderer();
      }, 0);
    };

    const clearCommentsHoverPreviews = () => {
      for (const { boxId, labelId } of commentsHoverPreviews) {
        actions.removeGrabbedBox(boxId);
        if (labelId) {
          actions.removeLabelInstance(labelId);
        }
      }
      commentsHoverPreviews = [];
    };

    const addCommentItemPreview = (
      item: CommentItem,
      previewBounds: OverlayBounds[],
      previewElements: Element[],
      idPrefix: string,
      trackingArray: {
        boxId: string;
        labelId: string | null;
      }[] = commentsHoverPreviews,
    ) => {
      if (previewBounds.length === 0) return;

      for (const [index, bounds] of previewBounds.entries()) {
        const previewElement = previewElements[index];
        const boxId = `${idPrefix}-${item.id}-${index}`;
        // HACK: createdAt=0 is falsy, which skips the auto-fade logic in the overlay canvas animation loop
        actions.addGrabbedBox({
          id: boxId,
          bounds,
          createdAt: 0,
          element: previewElement,
        });

        let labelId: string | null = null;
        if (index === 0) {
          labelId = `${idPrefix}-label-${item.id}`;
          actions.addLabelInstance({
            id: labelId,
            itemId: item.id,
            selectionBounds: bounds,
            tagName: item.tagName,
            componentName: item.componentName,
            elementsCount: item.elementsCount,
            status: "idle",
            isPromptMode: Boolean(item.commentText),
            inputValue: item.commentText ?? undefined,
            createdAt: 0,
            element: previewElement,
            mouseX: bounds.x + bounds.width / 2,
            groupId: item.groupId ?? undefined,
            commentText: item.commentText,
            timestamp: item.timestamp,
            hasElementScreenshot: Boolean(item.screenshotElement),
            hasFullPageScreenshot: Boolean(item.screenshotFullPage),
          });
        }

        trackingArray.push({ boxId, labelId });
      }
    };

    const selectionGroups = createSelectionGroups({
      commentItems: syncLayer.comments,
      persistCommentItems: syncLayer.persistComments,
      groups: syncLayer.groups,
      persistGroups: syncLayer.persistGroups,
    });

    // --- Per-item ticketing orchestrator ---
    // State shape is { group, items } regardless of whether `group` is
    // a real user-facing group or a synthetic 1-item group — the dialog
    // only needs group.name + group.id + the items to list in the
    // description. One shape, one mount, no casts.
    const [looseTicketDialog, setLooseTicketDialog] = createSignal<{
      group: SelectionGroup;
      items: CommentItem[];
    } | null>(null);

    const handleCreateTicketForLooseItem = (item: CommentItem) => {
      // Every item has a group (real or synthetic) from selection time.
      // Find it and open the dialog.
      const group = selectionGroups.groups().find((g) => g.id === item.groupId);
      if (!group) return;

      const groupItems = isSynthetic(group)
        ? [item]
        : commentItems().filter((ci) => ci.groupId === group.id);

      setLooseTicketDialog({
        group,
        items: groupItems,
      });
    };
    // --- end per-item ticketing orchestrator ---

    const computedLabelInstancesWithStatus = createMemo(() => {
      // Resolve each label instance's live groupId from the backing
      // CommentItem rather than the instance's frozen snapshot. This
      // makes the selection-label's group picker reactive to moves:
      // when handleMoveItem writes commentItems, the memo re-runs,
      // the new groupId flows into the picker's activeGroupId, and
      // the jira-field merge below uses the correct (new) group.
      const items = commentItems();
      return computedLabelInstances().map((instance) => {
        const liveItem = instance.itemId
          ? items.find((item) => item.id === instance.itemId)
          : undefined;
        const effectiveGroupId = liveItem
          ? (liveItem.groupId ?? undefined)
          : instance.groupId;
        const withLiveGroup =
          effectiveGroupId === instance.groupId
            ? instance
            : { ...instance, groupId: effectiveGroupId };

        if (!effectiveGroupId) return withLiveGroup;
        const group = selectionGroups
          .groups()
          .find((g) => g.id === effectiveGroupId) as
          | SelectionGroupWithJira
          | undefined;
        return {
          ...withLiveGroup,
          groupStatus: group?.jiraStatus,
          jiraTicketId: group?.jiraTicketId,
          jiraUrl: group?.jiraUrl,
          jiraStatusCategory: group?.jiraStatusCategory,
          jiraAssignee: group?.jiraAssignee,
          jiraReporter: group?.jiraReporter,
          jiraAssigneeAvatar: group?.jiraAssigneeAvatar,
          jiraReporterAvatar: group?.jiraReporterAvatar,
          jiraLabels: group?.jiraLabels,
          jiraComments: group?.jiraComments,
          jiraFlagged: group?.jiraFlagged,
          jiraFlaggedAt: group?.jiraFlaggedAt,
          jiraFlaggedBy: group?.jiraFlaggedBy,
          jiraFlaggedByAvatar: group?.jiraFlaggedByAvatar,
          jiraPriority: group?.jiraPriority,
          jiraIssueType: group?.jiraIssueType,
          jiraDueDate: group?.jiraDueDate,
        };
      });
    });

    const visibility = createSelectionVisibility({
      commentItems,
      setCommentItems,
      persistCommentItems,
      getConnectedCommentElements,
      disconnectedItemIds: commentsDisconnectedItemIds,
      createElementBounds,
      addCommentItemPreview,
      actions: {
        removeGrabbedBox: actions.removeGrabbedBox,
        removeLabelInstance: actions.removeLabelInstance,
      },
      currentToolbarState,
      updateToolbarState,
      // NEW: group deps
      groups: selectionGroups.groups,
      setGroups: selectionGroups.setGroups,
      persistGroups: selectionGroups.persistGroups,
    });

    const showCommentItemPreview = (
      item: CommentItem,
      idPrefix: string,
    ): void => {
      const connectedElements = getConnectedCommentElements(item);
      const previewBounds = connectedElements.map((element) =>
        createElementBounds(element),
      );
      addCommentItemPreview(item, previewBounds, connectedElements, idPrefix);
    };

    const stopTrackingDropdownPosition = () => {
      if (dropdownTrackingFrameId !== null) {
        nativeCancelAnimationFrame(dropdownTrackingFrameId);
        dropdownTrackingFrameId = null;
      }
    };

    const startTrackingDropdownPosition = (computePosition: () => void) => {
      stopTrackingDropdownPosition();
      const updatePosition = () => {
        computePosition();
        dropdownTrackingFrameId = nativeRequestAnimationFrame(updatePosition);
      };
      updatePosition();
    };

    const computeDropdownAnchor = (): DropdownAnchor | null => {
      if (!toolbarElement) return null;
      const toolbarRect = toolbarElement.getBoundingClientRect();
      const edge = getNearestEdge(toolbarRect);

      if (edge === "left" || edge === "right") {
        return {
          x: edge === "left" ? toolbarRect.right : toolbarRect.left,
          y: toolbarRect.top + toolbarRect.height / 2,
          edge,
          toolbarWidth: toolbarRect.width,
        };
      }

      return {
        x: toolbarRect.left + toolbarRect.width / 2,
        y: edge === "top" ? toolbarRect.bottom : toolbarRect.top,
        edge,
        toolbarWidth: toolbarRect.width,
      };
    };

    const openTrackedDropdown = (
      setPosition: (anchor: DropdownAnchor) => void,
    ) => {
      startTrackingDropdownPosition(() => {
        const anchor = computeDropdownAnchor();
        if (anchor) setPosition(anchor);
      });
    };

    const dismissCommentsDropdown = () => {
      cancelCommentsHoverOpenTimeout();
      cancelCommentsHoverCloseTimeout();
      stopTrackingDropdownPosition();
      clearCommentsHoverPreviews();
      setCommentsDropdownPosition(null);
      setIsCommentsHoverOpen(false);
    };

    const dismissToolbarMenu = () => {
      stopTrackingDropdownPosition();
      setToolbarMenuPosition(null);
    };

    const openCommentsDropdown = () => {
      actions.hideContextMenu();
      dismissToolbarMenu();
      dismissClearPrompt();
      openTrackedDropdown(setCommentsDropdownPosition);
    };

    let commentsHoverOpenTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let commentsHoverCloseTimeoutId: ReturnType<typeof setTimeout> | null =
      null;

    const cancelCommentsHoverOpenTimeout = () => {
      if (commentsHoverOpenTimeoutId !== null) {
        clearTimeout(commentsHoverOpenTimeoutId);
        commentsHoverOpenTimeoutId = null;
      }
    };

    const cancelCommentsHoverCloseTimeout = () => {
      if (commentsHoverCloseTimeoutId !== null) {
        clearTimeout(commentsHoverCloseTimeoutId);
        commentsHoverCloseTimeoutId = null;
      }
    };

    const scheduleCommentsHoverClose = () => {
      commentsHoverCloseTimeoutId = setTimeout(() => {
        commentsHoverCloseTimeoutId = null;
        dismissCommentsDropdown();
      }, DROPDOWN_HOVER_OPEN_DELAY_MS);
    };

    const showClearPrompt = () => {
      dismissCommentsDropdown();
      dismissToolbarMenu();
      openTrackedDropdown(setClearPromptPosition);
    };

    const dismissClearPrompt = () => {
      stopTrackingDropdownPosition();
      setClearPromptPosition(null);
    };

    const dismissAllPopups = () => {
      dismissCommentsDropdown();
      dismissToolbarMenu();
      dismissClearPrompt();
    };

    const handleToggleToolbarMenu = () => {
      if (toolbarMenuPosition() !== null) {
        dismissToolbarMenu();
      } else {
        actions.hideContextMenu();
        dismissCommentsDropdown();
        dismissClearPrompt();
        openTrackedDropdown(setToolbarMenuPosition);
      }
    };

    const handleSetDefaultAction = (actionId: string) => {
      updateToolbarState({ defaultAction: actionId });
    };

    const handleToggleComments = () => {
      cancelCommentsHoverOpenTimeout();
      cancelCommentsHoverCloseTimeout();
      const isCurrentlyOpen = commentsDropdownPosition() !== null;
      if (isCurrentlyOpen) {
        if (isCommentsHoverOpen()) {
          clearCommentsHoverPreviews();
          setIsCommentsHoverOpen(false);
        } else {
          dismissCommentsDropdown();
        }
      } else {
        clearCommentsHoverPreviews();
        openCommentsDropdown();
      }
    };

    const copyCommentItemContent = (item: CommentItem) => {
      copyContent(item.content, {
        tagName: item.tagName,
        componentName: item.componentName ?? item.elementName,
        commentText: item.commentText,
      });
      const element = getFirstConnectedCommentElement(item);
      if (!element) return;

      clearAllLabels();

      // HACK: defer to next frame so idle preview label clears visually before "copied" appears
      nativeRequestAnimationFrame(() => {
        if (!isElementConnected(element)) return;
        const bounds = createElementBounds(element);
        const labelId = createLabelInstance(
          bounds,
          item.tagName,
          item.componentName,
          "copied",
          { element, mouseX: bounds.x + bounds.width / 2 },
        );
        if (labelId) scheduleLabelFade(labelId);
      });
    };

    const handleCommentItemSelect = (item: CommentItem) => {
      clearCommentsHoverPreviews();
      if (isPromptMode()) {
        actions.exitPromptMode();
        actions.clearInputText();
      }
      const element = getFirstConnectedCommentElement(item);

      if (item.commentText && element) {
        const { center } = getElementBoundsCenter(element);
        actions.enterPromptMode(center, element);
        actions.setInputText(item.commentText);
      } else {
        copyCommentItemContent(item);
      }
    };

    const handleCommentsCopyAll = () => {
      clearCommentsHoverPreviews();

      const disconnected = commentsDisconnectedItemIds();
      const currentItems = commentItems();
      const currentGroups = selectionGroups.groups();

      // Filter: only revealed + connected items
      const copyableItems = currentItems.filter(
        (item) => item.revealed && !disconnected.has(item.id),
      );
      if (copyableItems.length === 0) return;

      // Group the copyable items
      const grouped = groupComments(currentGroups, copyableItems);
      const nonEmptyGroups = grouped.filter((g) => g.items.length > 0);

      // Build grouped snippets for text/plain
      const groupedSnippets: GroupedSnippet[] = nonEmptyGroups.map((g) => ({
        groupName: g.group.name,
        entries: g.items.map((item) => ({
          content: item.content,
          commentText: item.commentText,
        })),
      }));
      const combinedContent = joinGroupedSnippets(groupedSnippets);

      // Build grouped metadata for clipboard
      const metadataGroups: ReactGrabGroup[] = nonEmptyGroups.map((g) => ({
        name: g.group.name,
        entries: g.items.map((item) => ({
          tagName: item.tagName,
          componentName: item.componentName ?? item.elementName,
          content: item.content,
          commentText: item.commentText,
        })),
      }));
      copyGroupedContent(combinedContent, metadataGroups);

      if (isClearConfirmed()) {
        handleCommentsClear();
      } else {
        showClearPrompt();
      }

      clearAllLabels();

      // HACK: defer to next frame so idle preview labels clear visually before "copied" appears
      nativeRequestAnimationFrame(() => {
        batch(() => {
          for (const item of copyableItems) {
            const connectedElements = getConnectedCommentElements(item);
            for (const element of connectedElements) {
              const bounds = createElementBounds(element);
              const labelId = generateId("label");

              actions.addLabelInstance({
                id: labelId,
                selectionBounds: bounds,
                tagName: item.tagName,
                componentName: item.componentName,
                status: "copied",
                createdAt: Date.now(),
                element,
                mouseX: bounds.x + bounds.width / 2,
              });
              scheduleLabelFade(labelId);
            }
          }
        });
      });
    };

    const handleCopyGroup = (groupId: string) => {
      const disconnected = commentsDisconnectedItemIds();
      const currentItems = commentItems();
      const currentGroups = selectionGroups.groups();
      const group = currentGroups.find((g) => g.id === groupId);
      if (!group) return;

      // Filter: items in this group that are revealed + connected
      const copyableItems = currentItems.filter(
        (item) =>
          item.groupId === groupId &&
          item.revealed &&
          !disconnected.has(item.id),
      );
      if (copyableItems.length === 0) return;

      // Single group — no header needed
      const groupedSnippets: GroupedSnippet[] = [
        {
          groupName: group.name,
          entries: copyableItems.map((item) => ({
            content: item.content,
            commentText: item.commentText,
          })),
        },
      ];
      const combinedContent = joinGroupedSnippets(groupedSnippets);

      const metadataGroups: ReactGrabGroup[] = [
        {
          name: group.name,
          entries: copyableItems.map((item) => ({
            tagName: item.tagName,
            componentName: item.componentName ?? item.elementName,
            content: item.content,
            commentText: item.commentText,
          })),
        },
      ];
      copyGroupedContent(combinedContent, metadataGroups);

      // Show "copied" labels for copied items
      nativeRequestAnimationFrame(() => {
        batch(() => {
          for (const item of copyableItems) {
            const connectedElements = getConnectedCommentElements(item);
            for (const element of connectedElements) {
              const bounds = createElementBounds(element);
              const labelId = generateId("label");

              actions.addLabelInstance({
                id: labelId,
                selectionBounds: bounds,
                tagName: item.tagName,
                componentName: item.componentName,
                status: "copied",
                createdAt: Date.now(),
                element,
                mouseX: bounds.x + bounds.width / 2,
              });
              scheduleLabelFade(labelId);
            }
          }
        });
      });
    };

    const handleCommentItemHover = (commentItemId: string | null) => {
      // Don't show hover preview for items already revealed (they have pinned previews)
      clearCommentsHoverPreviews();
      if (!commentItemId) return;
      const item = commentItems().find(
        (innerItem) => innerItem.id === commentItemId,
      );
      if (!item) return;
      if (visibility.isItemRevealed(item.id)) return;
      showCommentItemPreview(item, "comment-hover");
    };

    const handleCommentsButtonHover = (isHovered: boolean) => {
      cancelCommentsHoverOpenTimeout();
      clearCommentsHoverPreviews();
      if (isHovered) {
        cancelCommentsHoverCloseTimeout();
        if (
          commentsDropdownPosition() === null &&
          clearPromptPosition() === null
        ) {
          for (const item of commentItems()) {
            if (!visibility.isItemRevealed(item.id)) {
              showCommentItemPreview(item, "comment-all-hover");
            }
          }
          commentsHoverOpenTimeoutId = setTimeout(() => {
            commentsHoverOpenTimeoutId = null;
            setIsCommentsHoverOpen(true);
            openCommentsDropdown();
          }, DROPDOWN_HOVER_OPEN_DELAY_MS);
        }
      } else if (isCommentsHoverOpen()) {
        scheduleCommentsHoverClose();
      }
    };

    const handleCommentsDropdownHover = (isHovered: boolean) => {
      if (isHovered) {
        cancelCommentsHoverCloseTimeout();
      } else if (isCommentsHoverOpen()) {
        scheduleCommentsHoverClose();
      }
    };

    const handleCommentsCopyAllHover = (isHovered: boolean) => {
      clearCommentsHoverPreviews();
      if (isHovered) {
        cancelCommentsHoverCloseTimeout();
        for (const item of commentItems()) {
          if (!visibility.isItemRevealed(item.id)) {
            showCommentItemPreview(item, "comment-all-hover");
          }
        }
      } else if (isCommentsHoverOpen()) {
        scheduleCommentsHoverClose();
      }
    };

    const handleCommentsClear = () => {
      commentElementMap.clear();
      const updatedCommentItems = clearComments();
      setCommentItems(updatedCommentItems);
      dismissCommentsDropdown();
    };

    const handleShowContextMenuInstance = (instanceId: string) => {
      const instance = store.labelInstances.find(
        (labelInstance) => labelInstance.id === instanceId,
      );
      if (!instance?.element) return;
      if (!isElementConnected(instance.element)) return;

      const contextMenuElement = instance.element;
      const { center } = getElementBoundsCenter(contextMenuElement);
      const position = {
        x: instance.mouseX ?? center.x,
        y: center.y,
      };

      const elementsToFreeze =
        instance.elements && instance.elements.length > 0
          ? instance.elements.filter((element) => isElementConnected(element))
          : [contextMenuElement];

      // HACK: Defer context menu display to avoid event interference
      setTimeout(() => {
        if (!isActivated()) {
          actions.setWasActivatedByToggle(true);
          activateRenderer();
        }
        actions.setPointer(position);
        actions.setFrozenElements(elementsToFreeze);
        const hasMultipleElements = elementsToFreeze.length > 1;
        if (hasMultipleElements && instance.selectionBounds) {
          actions.setFrozenDragRect(
            createPageRectFromBounds(instance.selectionBounds),
          );
        }
        actions.freeze();
        actions.showContextMenu(position, contextMenuElement);
      }, 0);
    };

    createEffect(() => {
      const hue = pluginRegistry.store.theme.hue;
      if (hue !== 0) {
        rendererRoot.style.filter = `hue-rotate(${hue}deg)`;
      } else {
        rendererRoot.style.filter = "";
      }
    });

    if (pluginRegistry.store.theme.enabled) {
      // HACK: Dynamically imported to avoid solid-js/web's delegateEvents() running
      // at module evaluation time, which crashes during SSR (window is not defined).
      void import("../components/renderer.js")
        .then(async ({ ReactGrabRenderer }) => {
          if (process.env.NODE_ENV !== "production") {
            try {
              // HACK: Non-literal specifier + @vite-ignore prevents consumer
              // bundlers (e.g. Vite via a symlinked dev build of react-grab)
              // from trying to statically resolve this optional dev-only dep
              // before the try/catch runs. See ADC local-dev integration.
              const devtoolsPkg = "@solid-devtools/overlay";
              const { attachDevtoolsOverlay } = await import(
                /* @vite-ignore */ devtoolsPkg
              );
              attachDevtoolsOverlay();
            } catch {
              /* devtools not installed */
            }
          }
          if (disposed) return;
          disposeRenderer = render(() => {
            return (
              <ReactGrabRenderer
                selectionVisible={selectionVisible()}
                selectionBounds={selectionBounds()}
                selectionBoundsMultiple={selectionBoundsMultiple()}
                selectionShouldSnap={
                  store.frozenElements.length > 0 ||
                  dragPreviewBounds().length > 0
                }
                inspectVisible={isInspectMode() && inspectBounds().length > 0}
                inspectBounds={inspectBounds()}
                selectionElementsCount={store.frozenElements.length}
                selectionFilePath={store.selectionFilePath ?? undefined}
                selectionLineNumber={store.selectionLineNumber ?? undefined}
                selectionTagName={selectionTagName()}
                selectionComponentName={resolvedComponentName()}
                selectionLabelVisible={selectionLabelVisible()}
                selectionLabelStatus="idle"
                selectionActionCycleState={actionCycleState()}
                selectionArrowNavigationState={arrowNavigationState()}
                onArrowNavigationSelect={handleArrowNavigationSelect}
                inspectNavigationState={inspectNavigationState()}
                onInspectSelect={handleInspectSelect}
                labelInstances={computedLabelInstancesWithStatus()}
                collapsibleLabelsDefault={initialOptions.collapsibleLabels}
                labelsStartCollapsedDefault={
                  initialOptions.labelsStartCollapsed ??
                  initialOptions.collapsibleLabels
                }
                dragVisible={dragVisible()}
                dragBounds={dragBounds()}
                grabbedBoxes={computedGrabbedBoxes()}
                mouseX={
                  store.frozenElements.length > 1
                    ? undefined
                    : cursorPosition().x
                }
                isFrozen={
                  isFrozenPhase() || isActivated() || isToolbarSelectHovered()
                }
                inputValue={store.inputText}
                isPromptMode={isPromptMode()}
                hasAgent={store.hasAgentProvider}
                agentSessions={agentManager.sessions()}
                supportsUndo={store.supportsUndo}
                supportsFollowUp={store.supportsFollowUp}
                dismissButtonText={store.dismissButtonText}
                onDismissSession={agentManager.session.dismiss}
                onUndoSession={agentManager.session.undo}
                onFollowUpSubmitSession={handleFollowUpSubmit}
                onAcknowledgeSessionError={handleAcknowledgeError}
                onRetrySession={agentManager.session.retry}
                onShowContextMenuInstance={handleShowContextMenuInstance}
                onLabelInstanceHoverChange={handleLabelInstanceHoverChange}
                onInputChange={actions.setInputText}
                onInputSubmit={() => void handleInputSubmit()}
                onToggleExpand={handleToggleExpand}
                isPendingDismiss={isPendingDismiss()}
                selectionLabelShakeCount={selectionLabelShakeCount()}
                onConfirmDismiss={handleConfirmDismiss}
                onCancelDismiss={handleCancelDismiss}
                pendingAbortSessionId={store.pendingAbortSessionId}
                onRequestAbortSession={(sessionId) =>
                  actions.setPendingAbortSessionId(sessionId)
                }
                onAbortSession={handleAgentAbort}
                toolbarVisible={pluginRegistry.store.theme.toolbar.enabled}
                isActive={isActivated()}
                onToggleActive={handleToggleActive}
                enabled={isEnabled()}
                onToggleEnabled={handleToggleEnabled}
                isDevMode={isDevMode()}
                onToggleDevMode={handleToggleDevMode}
                shakeCount={toolbarShakeCount()}
                onToolbarStateChange={(state) => {
                  setCurrentToolbarState(state);
                  toolbarStateChangeCallbacks.forEach((callback) =>
                    callback(state),
                  );
                }}
                onSubscribeToToolbarStateChanges={(callback) => {
                  toolbarStateChangeCallbacks.add(callback);
                  return () => {
                    toolbarStateChangeCallbacks.delete(callback);
                  };
                }}
                onToolbarSelectHoverChange={setIsToolbarSelectHovered}
                onToolbarRef={(element) => {
                  toolbarElement = element;
                }}
                contextMenuPosition={contextMenuPosition()}
                contextMenuBounds={contextMenuBounds()}
                contextMenuTagName={contextMenuTagName()}
                contextMenuComponentName={contextMenuComponentName()}
                contextMenuHasFilePath={Boolean(
                  contextMenuFilePath()?.filePath,
                )}
                actions={pluginRegistry.store.actions}
                actionContext={contextMenuActionContext()}
                onContextMenuDismiss={handleContextMenuDismiss}
                onContextMenuHide={deferHideContextMenu}
                commentItems={commentItems()}
                commentsDisconnectedItemIds={commentsDisconnectedItemIds()}
                commentItemCount={commentItems().length}
                clockFlashTrigger={clockFlashTrigger()}
                commentsDropdownPosition={commentsDropdownPosition()}
                isCommentsPinned={
                  commentsDropdownPosition() !== null && !isCommentsHoverOpen()
                }
                onToggleComments={handleToggleComments}
                onCopyAll={handleCommentsCopyAll}
                onCopyAllHover={handleCommentsCopyAllHover}
                onCommentsButtonHover={handleCommentsButtonHover}
                onCommentItemSelect={handleCommentItemSelect}
                onCommentItemHover={handleCommentItemHover}
                onCommentsCopyAll={handleCommentsCopyAll}
                onCommentsCopyAllHover={handleCommentsCopyAllHover}
                onCommentsClear={handleCommentsClear}
                copyableCount={copyableItemCount()}
                onCopyGroup={handleCopyGroup}
                onCommentsDismiss={dismissCommentsDropdown}
                onCommentsDropdownHover={handleCommentsDropdownHover}
                toolbarMenuPosition={toolbarMenuPosition()}
                toolbarMenuActions={pluginRegistry.store.actions.filter(
                  (action) => action.showInToolbarMenu === true,
                )}
                defaultActionId={
                  currentToolbarState()?.defaultAction ?? DEFAULT_ACTION_ID
                }
                onSetDefaultAction={handleSetDefaultAction}
                onToggleToolbarMenu={handleToggleToolbarMenu}
                onToolbarMenuDismiss={dismissToolbarMenu}
                clearPromptPosition={clearPromptPosition()}
                onClearCommentsConfirm={() => {
                  confirmClear();
                  dismissClearPrompt();
                  handleCommentsClear();
                }}
                onClearCommentsCancel={dismissClearPrompt}
                selectionsRevealed={visibility.selectionsRevealed()}
                onToggleSelectionsRevealed={visibility.handleToggleParent}
                onToggleCommentItemRevealed={visibility.handleToggleItem}
                syncStatus={derivedSyncStatus()}
                syncWorkspace={syncLayer.workspace() ?? undefined}
                syncServerUrl={syncLayer.serverUrl() ?? undefined}
                jiraProjectKey={syncLayer.jiraProjectKey() ?? undefined}
                groups={selectionGroups.groups()}
                activeGroupId={selectionGroups.activeGroupId()}
                onAddGroup={selectionGroups.handleAddGroup}
                onRenameGroup={selectionGroups.handleRenameGroup}
                onDeleteGroup={selectionGroups.handleDeleteGroup}
                onActiveGroupChange={(groupId) => {
                  selectionGroups.setActiveGroupId(groupId);
                  // If the active selection backs a saved CommentItem,
                  // persist the group change via handleMoveItem (server),
                  // not just the "next new selection" default.
                  const itemId = findFocusedCommentItemId();
                  if (itemId) selectionGroups.handleMoveItem(itemId, groupId);
                }}
                onMoveItem={selectionGroups.handleMoveItem}
                onMoveItems={selectionGroups.handleMoveItems}
                onRemoveItem={(itemId) => {
                  selectionGroups.handleRemoveItem(itemId);
                }}
                onToggleGroupRevealed={visibility.handleToggleGroup}
                onFilterVisibilityChange={visibility.setGroupsRevealed}
                onJiraResolved={(groupId) => {
                  const updated = selectionGroups
                    .groups()
                    .map((g) =>
                      g.id === groupId ? { ...g, jiraResolved: true } : g,
                    );
                  selectionGroups.persistGroups(updated);
                }}
                onTicketCreated={(groupId, ticketId, ticketUrl) => {
                  const updated = selectionGroups
                    .groups()
                    .map((g) =>
                      g.id === groupId
                        ? { ...g, jiraTicketId: ticketId, jiraUrl: ticketUrl }
                        : g,
                    );
                  selectionGroups.persistGroups(updated);
                }}
                onCreateTicketForLooseItem={handleCreateTicketForLooseItem}
                looseTicketDialog={looseTicketDialog()}
                onLooseTicketDialogClose={() => setLooseTicketDialog(null)}
                onSubmitJiraComment={
                  syncLayer.workspace()
                    ? async (groupId, markdown, mentions, parentId) => {
                        const res = await addJiraComment(
                          syncLayer.workspace()!,
                          groupId,
                          { body: markdown, mentions, parentId },
                        );
                        if (res.status !== 200)
                          throw new Error("Failed to post comment");
                        return res.data as { id: string; created: string };
                      }
                    : undefined
                }
                onSearchJiraUsers={
                  syncLayer.workspace()
                    ? async (query) => {
                        const res = await searchJiraUsers({
                          query,
                          project: syncLayer.jiraProjectKey()!,
                        });
                        if (res.status !== 200) return [];
                        return res.data as Array<{
                          accountId: string;
                          displayName: string;
                          avatarUrl: string | null;
                        }>;
                      }
                    : undefined
                }
                onRefreshJiraStatus={
                  syncLayer.workspace()
                    ? (groupId) => {
                        getJiraTicketStatus(syncLayer.workspace()!, groupId)
                          .then((res) => {
                            if (res.status !== 200) return;
                            syncLayer.updateJiraStatus(groupId, res.data);
                          })
                          .catch(() => {});
                      }
                    : undefined
                }
                commentEditorToolbarVisible={
                  initialOptions.commentEditorToolbarVisible
                }
              />
            );
          }, rendererRoot);
        })
        .catch((error) => {
          console.warn("[react-grab] Failed to load renderer:", error);
        });
    }

    if (store.hasAgentProvider) {
      agentManager.session.tryResume();
    }

    const copyElementAPI = async (
      elements: Element | Element[],
    ): Promise<boolean> => {
      const elementsArray = Array.isArray(elements) ? elements : [elements];
      if (elementsArray.length === 0) return false;
      return engine ? engine.copyElement(elementsArray) : false;
    };

    const syncAgentFromRegistry = () => {
      const agentOpts = getAgentOptionsWithCallbacks();
      if (agentOpts) {
        agentManager._internal.setOptions(agentOpts);
      }
      const hasProvider = Boolean(agentOpts?.provider);
      actions.setHasAgentProvider(hasProvider);
      if (hasProvider && agentOpts?.provider) {
        const capturedProvider = agentOpts.provider;
        actions.setAgentCapabilities({
          supportsUndo: Boolean(capturedProvider.undo),
          supportsFollowUp: Boolean(capturedProvider.supportsFollowUp),
          dismissButtonText: capturedProvider.dismissButtonText,
          isAgentConnected: false,
        });

        if (capturedProvider.checkConnection) {
          capturedProvider
            .checkConnection()
            .then((isConnected) => {
              const currentAgentOpts = getAgentOptionsWithCallbacks();
              if (currentAgentOpts?.provider !== capturedProvider) {
                return;
              }
              actions.setAgentCapabilities({
                supportsUndo: Boolean(capturedProvider.undo),
                supportsFollowUp: Boolean(capturedProvider.supportsFollowUp),
                dismissButtonText: capturedProvider.dismissButtonText,
                isAgentConnected: isConnected,
              });
            })
            .catch((error) => {
              logRecoverableError("Agent connection check failed", error);
            });
        }

        agentManager.session.tryResume();
      } else {
        actions.setAgentCapabilities({
          supportsUndo: false,
          supportsFollowUp: false,
          dismissButtonText: undefined,
          isAgentConnected: false,
        });
      }
    };

    const api: ReactGrabAPI = {
      activate: () => {
        actions.setPendingCommentMode(false);
        if (!isActivated() && isEnabled()) {
          toggleActivate();
        }
      },
      deactivate: () => {
        if (isActivated() || isCopying()) {
          deactivateRenderer();
        }
      },
      toggle: () => {
        if (isActivated()) {
          deactivateRenderer();
        } else if (isEnabled()) {
          toggleActivate();
        }
      },
      comment: handleComment,
      isActive: () => isActivated(),
      isEnabled: () => isEnabled(),
      setEnabled: (_enabled: boolean) => {
        // No-op — overlay is always enabled now
      },
      isDevMode: () => isDevMode(),
      setDevMode: (devMode: boolean) => {
        if (devMode === isDevMode()) return;
        setIsDevMode(devMode);
        updateToolbarState({ devMode });
      },
      getToolbarState: () => loadToolbarState(),
      setToolbarState: (state: Partial<ToolbarState>) => {
        const currentState = loadToolbarState();
        const newState: ToolbarState = {
          edge: state.edge ?? currentState?.edge ?? "bottom",
          ratio:
            state.ratio ??
            currentState?.ratio ??
            TOOLBAR_DEFAULT_POSITION_RATIO,
          collapsed: state.collapsed ?? currentState?.collapsed ?? false,
          enabled: state.enabled ?? currentState?.enabled ?? true,
          devMode: state.devMode ?? currentState?.devMode ?? false,
          defaultAction:
            state.defaultAction ??
            currentState?.defaultAction ??
            DEFAULT_ACTION_ID,
          selectionsRevealed:
            state.selectionsRevealed ??
            currentState?.selectionsRevealed ??
            false,
        };
        saveToolbarState(newState);
        setCurrentToolbarState(newState);
        if (state.devMode !== undefined && state.devMode !== isDevMode()) {
          setIsDevMode(state.devMode);
        }
        toolbarStateChangeCallbacks.forEach((callback) => callback(newState));
      },
      onToolbarStateChange: (callback: (state: ToolbarState) => void) => {
        toolbarStateChangeCallbacks.add(callback);
        return () => {
          toolbarStateChangeCallbacks.delete(callback);
        };
      },
      dispose: () => {
        disposed = true;
        pendingSubmission = undefined;
        hasInited = false;
        engine?.dispose();
        disposeRenderer?.();
        cancelCommentsHoverOpenTimeout();
        cancelCommentsHoverCloseTimeout();
        stopTrackingDropdownPosition();
        toolbarStateChangeCallbacks.clear();
        syncLayer.dispose();
        dispose();
      },
      copyElement: copyElementAPI,
      getSource: async (element: Element): Promise<SourceInfo | null> => {
        const source = await resolveSource(element);
        if (!source) return null;
        return {
          filePath: source.filePath,
          lineNumber: source.lineNumber,
          componentName: source.componentName,
        };
      },
      getStackContext,
      getState: (): ReactGrabState => ({
        isActive: isActivated(),
        isDragging: isDragging(),
        isCopying: isCopying(),
        isPromptMode: isPromptMode(),
        isSelectionBoxVisible: Boolean(selectionVisible()),
        isDragBoxVisible: Boolean(dragVisible()),
        targetElement: targetElement(),
        dragBounds: dragBounds() ?? null,
        grabbedBoxes: [...publicGrabbedBoxes()],
        labelInstances: [...publicLabelInstances()],
        selectionFilePath: store.selectionFilePath,
        toolbarState: currentToolbarState(),
      }),
      setOptions: (newOptions: SettableOptions) => {
        pluginRegistry.setOptions(newOptions);
        engine?.setOptions({
          activationMode: pluginRegistry.store.options.activationMode,
          activationKey: pluginRegistry.store.options.activationKey,
          keyHoldDuration: pluginRegistry.store.options.keyHoldDuration,
          allowActivationInsideInput:
            pluginRegistry.store.options.allowActivationInsideInput,
          freezeReactUpdates: pluginRegistry.store.options.freezeReactUpdates,
          maxContextLines: pluginRegistry.store.options.maxContextLines,
        });
      },
      registerPlugin: (plugin: Plugin) => {
        pluginRegistry.register(plugin, api);
        syncAgentFromRegistry();
      },
      unregisterPlugin: (name: string) => {
        pluginRegistry.unregister(name);
        syncAgentFromRegistry();
      },
      getPlugins: () => pluginRegistry.getPluginNames(),
      getDisplayName: getComponentDisplayName,
    };

    for (const plugin of builtInPlugins) {
      pluginRegistry.register(plugin, api);
    }

    let engineCopyLabel: string | null = null;
    engine = initUpstream({
      ...settableOptions,
      telemetry: false,
      getContent: async (elements) => {
        const options = pluginRegistry.store.options;
        if (options.getContent) return options.getContent(elements);
        const snippets = await generateSnippet(elements, {
          maxLines: options.maxContextLines,
        });
        return joinSnippets(
          await Promise.all(
            snippets.map((snippet, index) =>
              snippet.trim()
                ? pluginRegistry.hooks.transformSnippet(
                    snippet,
                    elements[index],
                  )
                : "",
            ),
          ),
        );
      },
    });
    engine.registerPlugin({
      name: "product-ui",
      theme: { enabled: false, toolbar: { enabled: false } },
      hooks: {
        onOpenFile: pluginRegistry.hooks.onOpenFile,
        transformOpenFileUrl: pluginRegistry.hooks.transformOpenFileUrl,
        onActivate: () => {
          actions.activate();
          pluginRegistry.hooks.onActivate();
        },
        onDeactivate: () => {
          clearArrowNavigation();
          setIsInspectMode(false);
          if (!isCopying()) actions.deactivate();
          pluginRegistry.hooks.onDeactivate();
        },
        onElementHover: (element) => {
          actions.setDetectedElement(element);
        },
        onDragStart: (pageX, pageY) => {
          actions.startDrag({
            x: pageX - window.scrollX,
            y: pageY - window.scrollY,
          });
          pluginRegistry.hooks.onDragStart(pageX, pageY);
        },
        onDragEnd: (elements, bounds) => {
          actions.endDrag();
          actions.setFrozenElements(elements);
          actions.setFrozenDragRect(createPageRectFromBounds(bounds));
          pluginRegistry.hooks.onDragEnd(elements, bounds);
        },
        onStateChange: (state) => {
          if (disposed || isCopying()) return;
          if (!state.isActive) {
            actions.deactivate();
            return;
          }
          if (!isActivated()) actions.activate();
          actions.setDetectedElement(state.targetElement);
          if (state.targetElement && arrowNavigationElements().length > 0) {
            const index = arrowNavigationElements().indexOf(
              state.targetElement,
            );
            if (index < 0) openArrowNavigationMenu(state.targetElement);
            else setArrowNavigationActiveIndex(index);
          }
        },
        onPromptModeChange: (active, context) => {
          if (!active || !context.targetElement || disposed) return;
          const element = context.targetElement;
          if (!store.frozenElements.includes(element))
            actions.setFrozenElements([element]);
          enterCommentModeForElement(element, context.x, context.y);
        },
        onElementSelect: (element) => {
          if (disposed) return true;
          if (isPendingContextMenuSelect) {
            isPendingContextMenuSelect = false;
            actions.setFrozenElement(element);
            if (pendingDefaultActionId)
              runPendingDefaultAction(element, store.pointer);
            else openContextMenu(element, store.pointer);
            return true;
          }
          const result = pluginRegistry.hooks.onElementSelect(element);
          return result.pendingResult ?? result.wasIntercepted;
        },
        onBeforeCopy: async (elements) => {
          const element = elements[0];
          if (element) {
            engineCopyLabel = createLabelInstance(
              createElementBounds(element),
              getTagName(element) ?? "element",
              undefined,
              "copying",
              { element, elements, mouseX: store.pointer.x },
            );
          }
          actions.startCopy();
          await pluginRegistry.hooks.onBeforeCopy(elements);
        },
        transformCopyContent: async (content, elements) => {
          const transformed = await pluginRegistry.hooks.transformCopyContent(
            content,
            elements,
          );
          return pendingSubmission?.prompt
            ? `${pendingSubmission.prompt}\n\n${transformed}`
            : transformed;
        },
        onCopySuccess: (elements, content) => {
          if (disposed) return;
          const firstElement = elements[0];
          const componentName = firstElement
            ? getComponentDisplayName(firstElement)
            : null;
          const tagName = firstElement ? getTagName(firstElement) : null;
          handleCopySuccessWithComments({
            copiedElements: elements,
            content,
            extraPrompt: pendingSubmission?.prompt,
            groupId: pendingSubmission?.groupId,
            componentName,
            tagName,
            elementName: componentName ?? tagName ?? undefined,
          });
        },
        onCopyError: pluginRegistry.hooks.onCopyError,
        onAfterCopy: (elements, success) => {
          if (disposed) return;
          if (engineCopyLabel) updateLabelAfterCopy(engineCopyLabel, success);
          engineCopyLabel = null;
          if (success) actions.completeCopy(elements[0]);
          else actions.activate();
          pluginRegistry.hooks.onAfterCopy(elements, success);
        },
        onGrabbedBox: (bounds, element) => {
          if (pluginRegistry.store.theme.grabbedBoxes.enabled)
            showTemporaryGrabbedBox(createElementBounds(element), element);
        },
        onContextMenu: (element, position) => {
          actions.setFrozenElement(element);
          actions.setPointer(position);
          actions.freeze();
          openContextMenu(element, position);
        },
      },
    });

    // HACK: Force revalidation of Next.js project detection
    // since it's cached in the browser and not updated when the project is changed
    setTimeout(() => {
      checkIsNextProject(true);
    }, NEXTJS_REVALIDATION_DELAY_MS);

    return api;
  });
};

export { isInstrumentationActive } from "bippy";
export { getElementContext as formatElementInfo, getStack } from "./context.js";
export { DEFAULT_THEME } from "./theme.js";

export type {
  ActionContext,
  AgentCompleteResult,
  AgentContext,
  AgentOptions,
  AgentProvider,
  AgentSession,
  AgentSessionStorage,
  ContextMenuAction,
  Options,
  OverlayBounds,
  Plugin,
  PluginConfig,
  PluginHooks,
  ReactGrabAPI,
  ReactGrabRendererProps,
  SettableOptions,
  SourceInfo,
} from "../types.js";

export { copyContent } from "../utils/copy-content.js";
export { generateSnippet } from "../utils/generate-snippet.js";
