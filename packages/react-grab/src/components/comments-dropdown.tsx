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
import { UngroupedSection } from "../features/selection-groups/components/ungrouped-section.jsx";
import { groupComments, fuzzyMatchGroup } from "../features/selection-groups/business/group-operations.js";
import { isPresentedAsLoose } from "../features/selection-groups/business/membership.js";
import { filterUserFacingGroups } from "../features/selection-groups/business/synthetic-group.js";
import {
  DROPDOWN_EDGE_TRANSFORM_ORIGIN,
  DROPDOWN_ICON_SIZE_PX,
  DROPDOWN_MAX_WIDTH_PX,
  DROPDOWN_MIN_WIDTH_PX,
  DROPDOWN_VIEWPORT_PADDING_PX,
  FEEDBACK_DURATION_MS,
  SAFE_POLYGON_BUFFER_PX,
} from "../constants.js";
import { createSafePolygonTracker } from "../utils/safe-polygon.js";
import { cn } from "../utils/cn.js";
import { IconTrash } from "./icons/icon-trash.jsx";
import { IconCheck } from "./icons/icon-check.jsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip.js";
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

  const visibleGroups = () => filterUserFacingGroups(props.groups ?? []);

  const groupedItems = () =>
    groupComments(visibleGroups(), props.items);

  const ungroupedItems = () =>
    props.items.filter((item) => isPresentedAsLoose(item, props.groups ?? [], props.items));

  // Shared row renderer used by both UngroupedSection and GroupCollapsible.
  const renderRow = (item: CommentItem) => (
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
        <span class="text-[12px] leading-4 font-medium text-popover-foreground truncate">
          {getCommentItemDisplayName(item)}
        </span>
        <Show when={item.commentText}>
          <span class="text-[11px] leading-3 text-muted-foreground truncate mt-0.5">
            {item.commentText}
          </span>
        </Show>
      </span>
      <div class="flex items-center gap-1 shrink-0">
        <Show when={hoveredItemId() === item.id || openMoveId() === item.id}>
          <button
            data-react-grab-ignore-events
            class="flex items-center justify-center rounded p-0.5 text-muted-foreground hover:text-popover-foreground hover:bg-accent cursor-pointer transition-colors"
            title="Move to group"
            on:click={(e) => {
              e.stopPropagation();
              setOpenMoveId((id) => (id === item.id ? null : item.id));
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 16 16"
            >
              <path fill="currentColor" fill-rule="evenodd" d="M3 2.5a.5.5 0 0 0-.5.5v3h11V4.75a.5.5 0 0 0-.5-.5H7.69L5.94 2.5zm10.5 5h-11V13a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5zM1 3a2 2 0 0 1 2-2h3.56l1.75 1.75H13a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2z" clip-rule="evenodd" />
            </svg>
          </button>
        </Show>
        <span class="text-[10px] text-muted-foreground flex items-center justify-end">
          {formatRelativeTime(item.timestamp)}
        </span>
        <button
          data-react-grab-ignore-events
          class="flex items-center justify-center w-[18px] h-[18px] rounded hover:bg-accent transition-colors"
          on:click={(event) => {
            event.stopPropagation();
            props.onToggleItemRevealed?.(item.id);
          }}
          on:pointerdown={(event) => event.stopPropagation()}
          aria-label={item.revealed ? "Hide this selection" : "Reveal this selection"}
        >
          {item.revealed ? (
            <svg width="12" height="12" viewBox="0 0 16 16" class="text-purple-500">
              <path fill="currentColor" d="M5.75 8a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0" />
              <path fill="currentColor" fill-rule="evenodd" d="M8 2C4.433 2 1.319 4.232.167 7.38c-.146.4-.146.84 0 1.24C1.32 11.768 4.433 14 8 14c3.566 0 6.681-2.232 7.833-5.38.146-.4.146-.84 0-1.24C14.68 4.232 11.566 2 8 2m0 2.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5" clip-rule="evenodd" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 16 16" class="text-muted-foreground group-hover:text-popover-foreground transition-colors">
              <path fill="currentColor" fill-rule="evenodd" d="M8 3.5c-2.943 0-5.49 1.845-6.424 4.396a.3.3 0 0 0 0 .208C2.509 10.655 5.057 12.5 8 12.5s5.49-1.845 6.424-4.396a.3.3 0 0 0 0-.208C13.491 5.345 10.943 3.5 8 3.5M.167 7.38C1.32 4.232 4.433 2 8 2c3.566 0 6.681 2.232 7.833 5.38.146.4.146.84 0 1.24C14.68 11.768 11.566 14 8 14 4.433 14 1.319 11.768.167 8.62a1.8 1.8 0 0 1 0-1.24M8 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M5 8a3 3 0 1 1 6 0 3 3 0 0 1-6 0" clip-rule="evenodd" />
            </svg>
          )}
        </button>
      </div>
      <Show when={openMoveId() === item.id}>
        <GroupPickerFlyout
          groups={props.groups ?? []}
          excludeGroupId={item.groupId ?? undefined}
          onSelect={(groupId) => {
            props.onMoveItem?.(item.id, groupId);
            setOpenMoveId(null);
          }}
          onClose={() => setOpenMoveId(null)}
        />
      </Show>
    </div>
  );

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
        class="fixed text-[13px] antialiased filter-[drop-shadow(0px_1px_2px_#51515140)] select-none transition-[opacity,transform] duration-100 ease-out will-change-[opacity,transform]"
        style={{
          top: `${dropdown.displayPosition().top}px`,
          left: `${dropdown.displayPosition().left}px`,
          "z-index": "var(--z-dropdown)",
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
            "bg-popover",
          )}
          style={{
            "min-width": `${panelMinWidth()}px`,
            "max-width": `${clampedMaxWidth()}px`,
            "max-height": `${clampedMaxHeight()}px`,
          }}
        >
          <div class="contain-layout shrink-0 flex items-center justify-between px-2 pt-1.5 pb-1">
            <span class="text-[11px] font-medium text-muted-foreground">Comments</span>
            <Show when={props.items.length > 0}>
              <div class="flex items-center gap-[5px]">
                <Tooltip open={activeHeaderTooltip() === "clear"} placement="top">
                  <TooltipTrigger
                    as="button"
                    data-react-grab-ignore-events
                    data-react-grab-comments-clear
                    class="contain-layout shrink-0 flex items-center justify-center px-[3px] py-px rounded-sm bg-destructive/10 cursor-pointer transition-all hover:bg-destructive/20 press-scale h-[17px] text-destructive"
                    onClick={(event: MouseEvent) => {
                      event.stopPropagation();
                      setActiveHeaderTooltip(null);
                      props.onClearAll?.();
                    }}
                    onMouseEnter={() => setActiveHeaderTooltip("clear")}
                    onMouseLeave={() => setActiveHeaderTooltip(null)}
                  >
                    <IconTrash size={DROPDOWN_ICON_SIZE_PX} />
                  </TooltipTrigger>
                  <TooltipContent>Clear all</TooltipContent>
                </Tooltip>
                <Tooltip open={activeHeaderTooltip() === "copy"} placement="top">
                  <TooltipTrigger
                    as="button"
                    data-react-grab-ignore-events
                    data-react-grab-comments-copy-all
                    class="contain-layout shrink-0 flex items-center justify-center px-[3px] py-px rounded-sm bg-popover [border-width:0.5px] border-solid border-border cursor-pointer transition-all hover:bg-accent press-scale h-[17px]"
                    onClick={(event: MouseEvent) => {
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
                        <span class="text-popover-foreground text-[13px] leading-3.5 font-medium">
                          {props.copyableCount != null && props.copyableCount < (props.items?.length ?? 0)
                            ? `Copy (${props.copyableCount})`
                            : "Copy"}
                        </span>
                      }
                    >
                      <IconCheck
                        size={DROPDOWN_ICON_SIZE_PX}
                        class="text-popover-foreground"
                      />
                    </Show>
                  </TooltipTrigger>
                  <TooltipContent>Copy all</TooltipContent>
                </Tooltip>
              </div>
            </Show>
          </div>

          <Show when={(props.groups?.length ?? 0) > 1}>
            <div class="border-t border-border px-2 py-1">
              <div class="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 16 16" class="text-muted-foreground shrink-0"><path fill="currentColor" fill-rule="evenodd" d="M7 2.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9M1 7a6 6 0 1 1 10.74 3.68l3.29 3.29-1.06 1.06-3.29-3.29A6 6 0 0 1 1 7" clip-rule="evenodd" /></svg>
                <input
                  data-react-grab-ignore-events
                  type="text"
                  placeholder="Search groups..."
                  class="flex-1 text-[12px] bg-transparent outline-none placeholder:text-muted-foreground text-popover-foreground py-0.5"
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                />
              </div>
            </div>
          </Show>

          <div class="min-h-0 [border-top-width:0.5px] border-t-solid border-t-border px-2 py-1.5">
            <div
              ref={highlightContainerRef}
              data-react-grab-group-list
              class="relative flex flex-col max-h-[240px] overflow-y-auto -mx-2 -my-1.5 [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:rgba(0,0,0,0.15)_transparent]"
            >
              <div
                ref={highlightRef}
                class="pointer-events-none absolute bg-accent opacity-0 transition-[top,left,width,height,opacity] duration-75 ease-out"
              />
              <Show when={ungroupedItems().length > 0}>
                <UngroupedSection
                  items={ungroupedItems()}
                  isFirst={true}
                  renderItem={renderRow}
                />
              </Show>
              <For each={filteredGroupedItems()}>
                {(entry, index) => (
                  <GroupCollapsible
                    group={entry.group}
                    items={entry.items}
                    isFirst={index() === 0 && ungroupedItems().length === 0}
                    onRename={(groupId, name) => props.onRenameGroup?.(groupId, name)}
                    onDelete={(groupId) => props.onDeleteGroup?.(groupId)}
                    onToggleRevealed={(groupId) => props.onToggleGroupRevealed?.(groupId)}
                    onCopy={(groupId) => props.onCopyGroup?.(groupId)}
                    renderItem={renderRow}
                  />
                )}
              </For>
            </div>
          </div>

          <div class="border-t border-border px-2 py-1.5">
            <div class="flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 16 16" class="text-muted-foreground shrink-0"><path fill="currentColor" fill-rule="evenodd" d="M7.25 8.75V15h1.5V8.75H15v-1.5H8.75V1h-1.5v6.25H1v1.5z" clip-rule="evenodd" /></svg>
              <input
                data-react-grab-ignore-events
                type="text"
                placeholder="New group..."
                class="flex-1 text-[12px] bg-transparent outline-none placeholder:text-muted-foreground text-popover-foreground"
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
