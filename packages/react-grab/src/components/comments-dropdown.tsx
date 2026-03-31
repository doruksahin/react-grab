import {
  Show,
  For,
  onMount,
  onCleanup,
  createSignal,
  createEffect,
  on,
} from "solid-js";
import type { Component } from "solid-js";
import type { CommentItem, DropdownAnchor } from "../types.js";
import type { SelectionGroupsViewProps } from "../features/selection-groups/types.js";
import { GroupCollapsible } from "../features/selection-groups/components/group-collapsible.jsx";
import { GroupPickerFlyout } from "../features/selection-groups/components/group-picker-flyout.jsx";
import { groupComments, fuzzyMatchGroup } from "../features/selection-groups/business/group-operations.js";
import {
  DROPDOWN_EDGE_TRANSFORM_ORIGIN,
  DROPDOWN_ICON_SIZE_PX,
  DROPDOWN_MAX_WIDTH_PX,
  DROPDOWN_MIN_WIDTH_PX,
  DROPDOWN_VIEWPORT_PADDING_PX,
  FEEDBACK_DURATION_MS,
  SAFE_POLYGON_BUFFER_PX,
  Z_INDEX_LABEL,
} from "../constants.js";
import { createSafePolygonTracker } from "../utils/safe-polygon.js";
import { cn } from "../utils/cn.js";
import { IconTrash } from "./icons/icon-trash.jsx";
import { IconCheck } from "./icons/icon-check.jsx";
import { Tooltip } from "./tooltip.jsx";
import { createMenuHighlight } from "../utils/create-menu-highlight.js";
import { suppressMenuEvent } from "../utils/suppress-menu-event.js";
import { createAnchoredDropdown } from "../utils/create-anchored-dropdown.js";
import { formatRelativeTime } from "../utils/format-relative-time.js";

interface CommentsDropdownProps
  extends Pick<
    SelectionGroupsViewProps,
    | "groups"
    | "onAddGroup"
    | "onRenameGroup"
    | "onDeleteGroup"
    | "onToggleGroupRevealed"
    | "onMoveItem"
  > {
  position: DropdownAnchor | null;
  items: CommentItem[];
  disconnectedItemIds?: Set<string>;
  onSelectItem?: (item: CommentItem) => void;
  onItemHover?: (commentItemId: string | null) => void;
  onCopyAll?: () => void;
  onCopyAllHover?: (isHovered: boolean) => void;
  onClearAll?: () => void;
  onDismiss?: () => void;
  onDropdownHover?: (isHovered: boolean) => void;
  onToggleItemRevealed?: (commentItemId: string) => void;
  onCopyGroup?: (groupId: string) => void;
  copyableCount?: number;
}

const getCommentItemDisplayName = (item: CommentItem): string => {
  if (item.elementsCount && item.elementsCount > 1) {
    return `${item.elementsCount} elements`;
  }
  return item.componentName ?? item.tagName;
};

export const CommentsDropdown: Component<CommentsDropdownProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  const {
    containerRef: highlightContainerRef,
    highlightRef,
    updateHighlight,
    clearHighlight,
  } = createMenuHighlight();

  const safePolygonTracker = createSafePolygonTracker();

  const getToolbarTargetRects = () => {
    if (!containerRef) return null;
    const rootNode = containerRef.getRootNode() as Document | ShadowRoot;
    const toolbar = rootNode.querySelector<HTMLElement>(
      "[data-react-grab-toolbar]",
    );
    if (!toolbar) return null;
    const rect = toolbar.getBoundingClientRect();
    return [
      {
        x: rect.x - SAFE_POLYGON_BUFFER_PX,
        y: rect.y - SAFE_POLYGON_BUFFER_PX,
        width: rect.width + SAFE_POLYGON_BUFFER_PX * 2,
        height: rect.height + SAFE_POLYGON_BUFFER_PX * 2,
      },
    ];
  };

  const dropdown = createAnchoredDropdown(
    () => containerRef,
    () => props.position,
  );

  const [activeHeaderTooltip, setActiveHeaderTooltip] = createSignal<
    "clear" | "copy" | null
  >(null);
  const [isCopyAllConfirmed, setIsCopyAllConfirmed] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [hoveredItemId, setHoveredItemId] = createSignal<string | null>(null);
  const [openMoveId, setOpenMoveId] = createSignal<string | null>(null);

  let copyAllFeedbackTimeout: ReturnType<typeof setTimeout> | undefined;

  const groupedItems = () =>
    groupComments(props.groups ?? [], props.items);

  const filteredGroupedItems = () => {
    const query = searchQuery();
    if (!query) return groupedItems();
    return groupedItems().filter((entry) =>
      fuzzyMatchGroup(entry.group.name, query),
    );
  };

  // HACK: mouseenter doesn't fire when an element appears under the cursor, so we check :hover after the enter animation commits
  createEffect(
    on(
      () => dropdown.isAnimatedIn(),
      (animatedIn) => {
        if (animatedIn && containerRef?.matches(":hover")) {
          props.onDropdownHover?.(true);
        }
      },
      { defer: true },
    ),
  );

  const clampedMaxWidth = () =>
    Math.min(
      DROPDOWN_MAX_WIDTH_PX,
      window.innerWidth -
        dropdown.displayPosition().left -
        DROPDOWN_VIEWPORT_PADDING_PX,
    );

  const clampedMaxHeight = () =>
    window.innerHeight -
    dropdown.displayPosition().top -
    DROPDOWN_VIEWPORT_PADDING_PX;

  const panelMinWidth = () =>
    Math.max(DROPDOWN_MIN_WIDTH_PX, props.position?.toolbarWidth ?? 0);

  onMount(() => {
    dropdown.measure();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!props.position) return;
      if (event.code === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        props.onDismiss?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });

    onCleanup(() => {
      clearTimeout(copyAllFeedbackTimeout);
      dropdown.clearAnimationHandles();
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      safePolygonTracker.stop();
    });
  });

  return (
    <Show when={dropdown.shouldMount()}>
      <div
        ref={containerRef}
        data-react-grab-ignore-events
        data-react-grab-comments-dropdown
        class="fixed font-sans text-[13px] antialiased filter-[drop-shadow(0px_1px_2px_#51515140)] select-none transition-[opacity,transform] duration-100 ease-out will-change-[opacity,transform]"
        style={{
          top: `${dropdown.displayPosition().top}px`,
          left: `${dropdown.displayPosition().left}px`,
          "z-index": `${Z_INDEX_LABEL}`,
          "pointer-events": dropdown.isAnimatedIn() ? "auto" : "none",
          "transform-origin":
            DROPDOWN_EDGE_TRANSFORM_ORIGIN[dropdown.lastAnchorEdge()],
          opacity: dropdown.isAnimatedIn() ? "1" : "0",
          transform: dropdown.isAnimatedIn() ? "scale(1)" : "scale(0.95)",
        }}
        onPointerDown={suppressMenuEvent}
        onMouseDown={suppressMenuEvent}
        onClick={suppressMenuEvent}
        onContextMenu={suppressMenuEvent}
        onMouseEnter={() => {
          safePolygonTracker.stop();
          props.onDropdownHover?.(true);
        }}
        onMouseLeave={(event: MouseEvent) => {
          const targetRects = getToolbarTargetRects();
          if (targetRects) {
            safePolygonTracker.start(
              { x: event.clientX, y: event.clientY },
              targetRects,
              () => props.onDropdownHover?.(false),
            );
            return;
          }
          props.onDropdownHover?.(false);
        }}
      >
        <div
          class={cn(
            "contain-layout flex flex-col rounded-[10px] antialiased w-fit h-fit overflow-hidden [font-synthesis:none] [corner-shape:superellipse(1.25)]",
            "bg-white",
          )}
          style={{
            "min-width": `${panelMinWidth()}px`,
            "max-width": `${clampedMaxWidth()}px`,
            "max-height": `${clampedMaxHeight()}px`,
          }}
        >
          <div class="contain-layout shrink-0 flex items-center justify-between px-2 pt-1.5 pb-1">
            <span class="text-[11px] font-medium text-black/40">Comments</span>
            <Show when={props.items.length > 0}>
              <div class="flex items-center gap-[5px]">
                <div class="relative">
                  <button
                    data-react-grab-ignore-events
                    data-react-grab-comments-clear
                    class="contain-layout shrink-0 flex items-center justify-center px-[3px] py-px rounded-sm bg-[#FEF2F2] cursor-pointer transition-all hover:bg-[#FEE2E2] press-scale h-[17px] text-[#B91C1C]"
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveHeaderTooltip(null);
                      props.onClearAll?.();
                    }}
                    onMouseEnter={() => setActiveHeaderTooltip("clear")}
                    onMouseLeave={() => setActiveHeaderTooltip(null)}
                  >
                    <IconTrash size={DROPDOWN_ICON_SIZE_PX} />
                  </button>
                  <Tooltip
                    visible={activeHeaderTooltip() === "clear"}
                    position="top"
                  >
                    Clear all
                  </Tooltip>
                </div>
                <div class="relative">
                  <button
                    data-react-grab-ignore-events
                    data-react-grab-comments-copy-all
                    class="contain-layout shrink-0 flex items-center justify-center px-[3px] py-px rounded-sm bg-white [border-width:0.5px] border-solid border-[#B3B3B3] cursor-pointer transition-all hover:bg-[#F5F5F5] press-scale h-[17px]"
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveHeaderTooltip(null);
                      props.onCopyAll?.();
                      setIsCopyAllConfirmed(true);
                      clearTimeout(copyAllFeedbackTimeout);
                      copyAllFeedbackTimeout = setTimeout(() => {
                        setIsCopyAllConfirmed(false);
                      }, FEEDBACK_DURATION_MS);
                    }}
                    onMouseEnter={() => {
                      setActiveHeaderTooltip("copy");
                      if (!isCopyAllConfirmed()) {
                        props.onCopyAllHover?.(true);
                      }
                    }}
                    onMouseLeave={() => {
                      setActiveHeaderTooltip(null);
                      props.onCopyAllHover?.(false);
                    }}
                  >
                    <Show
                      when={isCopyAllConfirmed()}
                      fallback={
                        <span class="text-black text-[13px] leading-3.5 font-sans font-medium">
                          {props.copyableCount != null && props.copyableCount < (props.items?.length ?? 0)
                            ? `Copy (${props.copyableCount})`
                            : "Copy"}
                        </span>
                      }
                    >
                      <IconCheck
                        size={DROPDOWN_ICON_SIZE_PX}
                        class="text-black"
                      />
                    </Show>
                  </button>
                  <Tooltip
                    visible={activeHeaderTooltip() === "copy"}
                    position="top"
                  >
                    Copy all
                  </Tooltip>
                </div>
              </div>
            </Show>
          </div>

          <Show when={(props.groups?.length ?? 0) > 1}>
            <div class="border-t border-[#D9D9D9] px-2 py-1">
              <div class="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-black/25 shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input
                  data-react-grab-ignore-events
                  type="text"
                  placeholder="Search groups..."
                  class="flex-1 text-[12px] bg-transparent outline-none placeholder:text-black/25 text-black py-0.5"
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                />
              </div>
            </div>
          </Show>

          <div class="min-h-0 [border-top-width:0.5px] border-t-solid border-t-[#D9D9D9] px-2 py-1.5">
            <div
              ref={highlightContainerRef}
              class="relative flex flex-col max-h-[240px] overflow-y-auto -mx-2 -my-1.5 [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:rgba(0,0,0,0.15)_transparent]"
            >
              <div
                ref={highlightRef}
                class="pointer-events-none absolute bg-black/5 opacity-0 transition-[top,left,width,height,opacity] duration-75 ease-out"
              />
              <For each={filteredGroupedItems()}>
                {(entry, index) => (
                  <GroupCollapsible
                    group={entry.group}
                    items={entry.items}
                    isFirst={index() === 0}
                    onRename={(groupId, name) => props.onRenameGroup?.(groupId, name)}
                    onDelete={(groupId) => props.onDeleteGroup?.(groupId)}
                    onToggleRevealed={(groupId) => props.onToggleGroupRevealed?.(groupId)}
                    onCopy={(groupId) => props.onCopyGroup?.(groupId)}
                    renderItem={(item) => (
                      <div
                        data-react-grab-ignore-events
                        data-react-grab-comment-item
                        class="group relative z-1 contain-layout flex items-start justify-between w-full px-2 py-1 cursor-pointer text-left gap-2"
                        classList={{
                          "opacity-40 hover:opacity-100": Boolean(
                            props.disconnectedItemIds?.has(item.id),
                          ),
                        }}
                        tabindex="0"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          props.onSelectItem?.(item);
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.code === "Space" &&
                            event.currentTarget === event.target
                          ) {
                            event.preventDefault();
                            event.stopPropagation();
                            props.onSelectItem?.(item);
                          }
                        }}
                        onMouseEnter={(event) => {
                          if (!props.disconnectedItemIds?.has(item.id)) {
                            props.onItemHover?.(item.id);
                          }
                          setHoveredItemId(item.id);
                          updateHighlight(event.currentTarget);
                        }}
                        onMouseLeave={() => {
                          props.onItemHover?.(null);
                          setHoveredItemId(null);
                          clearHighlight();
                        }}
                        onFocus={(event) => updateHighlight(event.currentTarget)}
                        onBlur={clearHighlight}
                      >
                        <span class="flex flex-col min-w-0 flex-1">
                          <span class="text-[12px] leading-4 font-sans font-medium text-black truncate">
                            {getCommentItemDisplayName(item)}
                          </span>
                          <Show when={item.commentText}>
                            <span class="text-[11px] leading-3 font-sans text-black/40 truncate mt-0.5">
                              {item.commentText}
                            </span>
                          </Show>
                        </span>
                        <div class="flex items-center gap-1 shrink-0">
                          <Show when={hoveredItemId() === item.id || openMoveId() === item.id}>
                            <button
                              data-react-grab-ignore-events
                              class="flex items-center justify-center rounded p-0.5 text-black/25 hover:text-black/50 hover:bg-black/[0.06] cursor-pointer transition-colors"
                              title="Move to group"
                              on:click={(e) => {
                                e.stopPropagation();
                                setOpenMoveId((id) => (id === item.id ? null : item.id));
                              }}
                            >
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                              </svg>
                            </button>
                          </Show>
                          <span class="text-[10px] font-sans text-black/25 flex items-center justify-end">
                            {formatRelativeTime(item.timestamp)}
                          </span>
                          <button
                            data-react-grab-ignore-events
                            class="flex items-center justify-center w-[18px] h-[18px] rounded hover:bg-black/5 transition-colors"
                            on:click={(event) => {
                              event.stopPropagation();
                              props.onToggleItemRevealed?.(item.id);
                            }}
                            on:pointerdown={(event) => event.stopPropagation()}
                            aria-label={item.revealed ? "Hide this selection" : "Reveal this selection"}
                          >
                            {item.revealed ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-500">
                                <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>
                                <circle cx="12" cy="12" r="3" fill="currentColor"/>
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-black/20 group-hover:text-black/40 transition-colors">
                                <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/>
                                <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/>
                                <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/>
                                <path d="m2 2 20 20"/>
                              </svg>
                            )}
                          </button>
                        </div>
                        <Show when={openMoveId() === item.id}>
                          <GroupPickerFlyout
                            groups={props.groups ?? []}
                            excludeGroupId={item.groupId}
                            onSelect={(groupId) => {
                              props.onMoveItem?.(item.id, groupId);
                              setOpenMoveId(null);
                            }}
                            onClose={() => setOpenMoveId(null)}
                          />
                        </Show>
                      </div>
                    )}
                  />
                )}
              </For>
            </div>
          </div>

          <div class="border-t border-[#D9D9D9] px-2 py-1.5">
            <div class="flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-black/25 shrink-0"><path d="M12 5v14m-7-7h14"/></svg>
              <input
                data-react-grab-ignore-events
                type="text"
                placeholder="New group..."
                class="flex-1 text-[12px] bg-transparent outline-none placeholder:text-black/25 text-black"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.currentTarget.value.trim()) {
                    props.onAddGroup?.(e.currentTarget.value.trim());
                    e.currentTarget.value = "";
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};
