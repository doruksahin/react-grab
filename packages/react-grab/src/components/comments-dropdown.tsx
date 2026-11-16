import {
  Show,
  onMount,
  onCleanup,
  createSignal,
  createEffect,
  createMemo,
  on,
} from "solid-js";
import type { Component } from "solid-js";
import type { CommentItem, DropdownAnchor } from "../types.js";
import type { SelectionGroupsViewProps } from "../features/selection-groups/types.js";
import {
  GroupPickerFlyout,
  GroupPickerPopover,
  GroupPickerTrigger,
} from "./selection-groups/group-picker-flyout.jsx";
import { SelectionTreeView } from "./selection-groups/selection-tree-view.jsx";
import { fuzzyMatchGroup } from "../features/selection-groups/business/group-operations.js";
import { assignableGroupsFor } from "../features/selection-groups/business/membership-policy.js";
import { selectionTree } from "../features/selection-groups/business/selection-tree.js";
import { selectionRowFields } from "../features/selection-groups/business/selection-row-fields.js";
import {
  DROPDOWN_EDGE_TRANSFORM_ORIGIN,
  DROPDOWN_ICON_SIZE_PX,
  DROPDOWN_MAX_WIDTH_PX,
  DROPDOWN_MIN_WIDTH_PX,
  FEEDBACK_DURATION_MS,
  ICON_BUTTON_TOOLTIP_OPEN_DELAY_MS,
  SAFE_POLYGON_BUFFER_PX,
} from "../constants.js";
import { createSafePolygonTracker } from "../utils/safe-polygon.js";
import { cn } from "../utils/cn.js";
import { IconTrash } from "./icons/icon-trash.jsx";
import { IconCheck } from "./icons/icon-check.jsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip.js";
import { createMenuHighlight } from "../utils/create-menu-highlight.js";
import { suppressMenuEvent } from "../utils/suppress-menu-event.js";
import { createAnchoredDropdown } from "../utils/create-anchored-dropdown.js";
import { formatRelativeTime } from "../utils/format-relative-time.js";
import { IconButton } from "./ui/icon-button.js";
import { Button } from "./ui/button.js";
import { LocationChip } from "./selection-location/location-chip.jsx";
import { IconFolder } from "./icons/icon-folder.jsx";
import { IconEyeOff } from "./icons/icon-eye-off.jsx";
import { IconEyeFilled } from "./icons/icon-eye-filled.jsx";
import { RemoveSelectionButton } from "./remove-selection-button.jsx";
import type { ClearCounts } from "../features/selection-groups/business/membership-policy.js";

interface CommentsDropdownProps extends Pick<
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
  /** Remove one selection; shown only when `canRemoveItem` allows it (ADR-0008). */
  onRemoveItem?: (itemId: string) => void;
  canRemoveItem?: (itemId: string) => boolean;
  /** What "Clear all" deletes and keeps; a comment with a ticket stays (ADR-0008). */
  clearCounts?: ClearCounts;
  onDismiss?: () => void;
  onDropdownHover?: (isHovered: boolean) => void;
  onToggleItemRevealed?: (commentItemId: string) => void;
  onCopyGroup?: (groupId: string) => void;
  copyableCount?: number;
}

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
    { fitHeight: true, maxWidthPx: DROPDOWN_MAX_WIDTH_PX },
  );

  const [isCopyAllConfirmed, setIsCopyAllConfirmed] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [openMoveId, setOpenMoveId] = createSignal<string | null>(null);

  let copyAllFeedbackTimeout: ReturnType<typeof setTimeout> | undefined;

  // A locked selection has no targets, so it gets no move action at all.
  const moveTargetsFor = (item: CommentItem) =>
    assignableGroupsFor(item, props.groups ?? []);

  // The menu's row; the tree around it is SelectionTreeView (ADR-0028).
  const renderRow = (item: CommentItem) => (
    <div
      data-react-grab-ignore-events
      data-react-grab-comment-item
      class="group/row relative z-1 contain-layout flex items-start justify-between w-full px-2 py-1 cursor-pointer text-left gap-2"
      tabindex="0"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        props.onSelectItem?.(item);
      }}
      onKeyDown={(event) => {
        if (event.code === "Space" && event.currentTarget === event.target) {
          event.preventDefault();
          event.stopPropagation();
          props.onSelectItem?.(item);
        }
      }}
      onMouseEnter={(event) => {
        if (!props.disconnectedItemIds?.has(item.id)) {
          props.onItemHover?.(item.id);
        }
        updateHighlight(event.currentTarget);
      }}
      onMouseLeave={() => {
        props.onItemHover?.(null);
        clearHighlight();
      }}
      onFocus={(event) => updateHighlight(event.currentTarget)}
      onBlur={clearHighlight}
    >
      <span class="flex flex-col min-w-0 flex-1">
        <span class="text-caption leading-4 font-medium text-popover-foreground truncate">
          {selectionRowFields(item).title}
        </span>
        <Show when={selectionRowFields(item).detail}>
          {(detail) => (
            <span class="text-meta leading-3 text-muted-foreground truncate mt-0.5">
              {detail()}
            </span>
          )}
        </Show>
        <LocationChip
          selectionId={item.id}
          class="mt-1 max-w-full min-w-0 shrink self-start"
        />
      </span>
      <div class="grid shrink-0 [&>*]:col-start-1 [&>*]:row-start-1">
        <span
          class={cn(
            "flex h-4 items-center justify-end gap-1 text-meta text-muted-foreground group-hover/row:invisible group-focus-within/row:invisible",
            openMoveId() === item.id && "invisible",
          )}
        >
          <Show when={!item.revealed}>
            <span title="Hidden on the page" class="flex">
              <IconEyeOff size={12} />
            </span>
          </Show>
          {formatRelativeTime(item.timestamp)}
        </span>
        <div
          class={cn(
            "flex h-4 items-center justify-end gap-1 opacity-0 pointer-events-none group-hover/row:opacity-100 group-hover/row:pointer-events-auto group-focus-within/row:opacity-100 group-focus-within/row:pointer-events-auto",
            openMoveId() === item.id && "opacity-100 pointer-events-auto",
          )}
        >
          <Show when={moveTargetsFor(item).length > 0}>
            <GroupPickerPopover
              open={openMoveId() === item.id}
              onOpenChange={(open) => setOpenMoveId(open ? item.id : null)}
            >
              <GroupPickerTrigger
                as={IconButton}
                data-react-grab-ignore-events
                label="Move to group"
                size="icon-xs"
                onClick={(event: MouseEvent) => event.stopPropagation()}
              >
                <IconFolder size={10} />
              </GroupPickerTrigger>
              <GroupPickerFlyout
                groups={moveTargetsFor(item)}
                excludeGroupId={item.groupId ?? undefined}
                onSelect={(groupId) => {
                  props.onMoveItem?.(item.id, groupId);
                  setOpenMoveId(null);
                }}
              />
            </GroupPickerPopover>
          </Show>
          <Show when={props.canRemoveItem?.(item.id)}>
            <RemoveSelectionButton
              variant="overlay"
              onRemove={() => props.onRemoveItem?.(item.id)}
            />
          </Show>
          <IconButton
            data-react-grab-ignore-events
            label={
              item.revealed ? "Hide this selection" : "Reveal this selection"
            }
            size="icon-xs"
            on:click={(event) => {
              event.stopPropagation();
              props.onToggleItemRevealed?.(item.id);
            }}
            on:pointerdown={(event) => event.stopPropagation()}
          >
            <Show when={item.revealed} fallback={<IconEyeOff size={12} />}>
              <IconEyeFilled size={12} class="text-selection-strong" />
            </Show>
          </IconButton>
        </div>
      </div>
    </div>
  );

  // The group search narrows the group sections; Ungrouped always shows.
  const visibleTree = createMemo(() => {
    const tree = selectionTree(props.items, props.groups ?? []);
    const query = searchQuery();
    if (!query) return tree;
    return {
      ...tree,
      groups: tree.groups.filter((section) =>
        fuzzyMatchGroup(section.group.name, query),
      ),
    };
  });

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

  const panelMinWidth = () =>
    Math.max(DROPDOWN_MIN_WIDTH_PX, props.position?.toolbarWidth ?? 0);

  onMount(() => {
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
        class="fixed flex flex-col text-body antialiased drop-shadow-overlay select-none transition-[opacity,transform] duration-100 ease-out will-change-[opacity,transform]"
        style={{
          ...dropdown.floatingStyle(),
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
            "contain-layout flex flex-col rounded-[10px] antialiased w-fit h-fit min-h-0 max-w-full overflow-hidden [font-synthesis:none] [corner-shape:superellipse(1.25)]",
            "bg-popover",
          )}
          style={{
            "min-width": `${panelMinWidth()}px`,
          }}
        >
          <div class="contain-layout shrink-0 flex items-center justify-between px-2 pt-1.5 pb-1">
            <span class="text-meta font-medium text-muted-foreground">
              Comments
            </span>
            <Show when={props.items.length > 0}>
              <div class="flex items-center gap-[5px]">
                <Show when={(props.clearCounts?.removed ?? 0) > 0}>
                  <IconButton
                    data-react-grab-ignore-events
                    data-react-grab-comments-clear
                    label={
                      (props.clearCounts?.kept ?? 0) > 0
                        ? "Clear comments without a ticket"
                        : "Clear all"
                    }
                    variant="subtle-destructive"
                    size="icon-xs"
                    class="shrink-0"
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onClearAll?.();
                    }}
                  >
                    <IconTrash size={DROPDOWN_ICON_SIZE_PX} />
                  </IconButton>
                </Show>
                <Tooltip openDelay={ICON_BUTTON_TOOLTIP_OPEN_DELAY_MS}>
                  <TooltipTrigger
                    as={Button}
                    data-react-grab-ignore-events
                    data-react-grab-comments-copy-all
                    variant="chip"
                    class="shrink-0"
                    onClick={(event: MouseEvent) => {
                      event.stopPropagation();
                      props.onCopyAll?.();
                      setIsCopyAllConfirmed(true);
                      clearTimeout(copyAllFeedbackTimeout);
                      copyAllFeedbackTimeout = setTimeout(() => {
                        setIsCopyAllConfirmed(false);
                      }, FEEDBACK_DURATION_MS);
                    }}
                    onMouseEnter={() => {
                      if (!isCopyAllConfirmed()) {
                        props.onCopyAllHover?.(true);
                      }
                    }}
                    onMouseLeave={() => props.onCopyAllHover?.(false)}
                  >
                    <Show
                      when={isCopyAllConfirmed()}
                      fallback={
                        <span>
                          {props.copyableCount != null &&
                          props.copyableCount > 0 &&
                          props.copyableCount < (props.items?.length ?? 0)
                            ? `Copy ${props.copyableCount} visible`
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
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  class="text-muted-foreground shrink-0"
                >
                  <path
                    fill="currentColor"
                    fill-rule="evenodd"
                    d="M7 2.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9M1 7a6 6 0 1 1 10.74 3.68l3.29 3.29-1.06 1.06-3.29-3.29A6 6 0 0 1 1 7"
                    clip-rule="evenodd"
                  />
                </svg>
                <input
                  data-react-grab-ignore-events
                  type="text"
                  placeholder="Search groups..."
                  class="flex-1 text-caption bg-transparent outline-none placeholder:text-muted-foreground text-popover-foreground py-0.5"
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                />
              </div>
            </div>
          </Show>

          <div class="min-h-0 [border-top-width:0.5px] border-t-solid border-t-border px-2 py-1.5">
            <div
              ref={highlightContainerRef}
              data-react-grab-group-list
              class="relative flex flex-col max-h-[240px] overflow-y-auto -mx-2 -my-1.5 [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:var(--color-scrollbar-thumb)_transparent]"
            >
              <div
                ref={highlightRef}
                class="pointer-events-none absolute bg-accent opacity-0 transition-[top,left,width,height,opacity] duration-75 ease-out"
              />
              <SelectionTreeView
                tree={visibleTree()}
                renderItem={renderRow}
                onRenameGroup={props.onRenameGroup}
                onDeleteGroup={props.onDeleteGroup}
                onToggleGroupRevealed={props.onToggleGroupRevealed}
                onCopyGroup={props.onCopyGroup}
              />
            </div>
          </div>

          <div class="border-t border-border px-2 py-1.5">
            <div class="flex items-center gap-1.5">
              <svg
                width="10"
                height="10"
                viewBox="0 0 16 16"
                class="text-muted-foreground shrink-0"
              >
                <path
                  fill="currentColor"
                  fill-rule="evenodd"
                  d="M7.25 8.75V15h1.5V8.75H15v-1.5H8.75V1h-1.5v6.25H1v1.5z"
                  clip-rule="evenodd"
                />
              </svg>
              <input
                data-react-grab-ignore-events
                type="text"
                placeholder="New group..."
                class="flex-1 text-caption bg-transparent outline-none placeholder:text-muted-foreground text-popover-foreground"
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
